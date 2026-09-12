<?php

namespace App\Http\Controllers\Client;

use App\Enums\KycStatus;
use App\Http\Controllers\Controller;
use App\Models\KycDocument;
use App\Models\KycProfile;
use App\Services\Audit\AuditLoggerService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class KycController extends Controller
{
    /**
     * Redirect to profile KYC section.
     */
    public function index(): RedirectResponse
    {
        return redirect()->to(route('client.profile') . '#kyc-section');
    }

    /**
     * Upload a KYC verification document (ID proof or address proof).
     */
    public function uploadDocument(Request $request): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        $validated = $request->validate([
            'document_type' => ['required', Rule::in(['id_proof', 'address_proof'])],
            'document_file' => ['required', 'file', 'mimes:jpeg,jpg,png,pdf', 'max:5120'], // 5MB max
        ]);

        $file = $request->file('document_file');
        
        // Store safely in private storage outside public web root
        $path = $file->store('kyc_documents', 'local');

        // Delete previous document file of same type if pending or rejected
        $existingDoc = KycDocument::where('user_id', $user->id)
            ->where('document_type', $validated['document_type'])
            ->first();

        if ($existingDoc) {
            if (Storage::disk('local')->exists($existingDoc->file_path)) {
                Storage::disk('local')->delete($existingDoc->file_path);
            }
            $existingDoc->update([
                'file_path' => $path,
                'status' => 'pending',
                'rejection_reason' => null,
            ]);
            $document = $existingDoc;
        } else {
            $document = KycDocument::create([
                'user_id' => $user->id,
                'document_type' => $validated['document_type'],
                'file_path' => $path,
                'status' => 'pending',
                'rejection_reason' => null,
            ]);
        }

        // Ensure KYC Profile exists
        $profile = KycProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => KycStatus::PENDING->value]
        );

        if ($profile->status === KycStatus::NOT_SUBMITTED || $profile->status === KycStatus::REJECTED) {
            $profile->update(['status' => KycStatus::PENDING->value]);
        }

        AuditLoggerService::log(
            'kyc_document_uploaded',
            $user,
            KycDocument::class,
            $document->id,
            "Client uploaded {$validated['document_type']} verification document"
        );

        return redirect()->to(route('client.profile') . '#kyc-section')
            ->with('success', ucfirst(str_replace('_', ' ', $validated['document_type'])) . ' uploaded successfully.');
    }

    /**
     * Submit KYC profile for admin review.
     */
    public function submit(Request $request): RedirectResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        $docsCount = KycDocument::where('user_id', $user->id)->count();
        if ($docsCount === 0) {
            return redirect()->to(route('client.profile') . '#kyc-section')
                ->with('error', 'Please upload at least one verification document before submitting.');
        }

        $profile = KycProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['status' => KycStatus::PENDING->value]
        );

        $profile->update([
            'status' => KycStatus::PENDING->value,
            'rejection_reason' => null,
        ]);

        AuditLoggerService::log(
            'kyc_profile_submitted',
            $user,
            KycProfile::class,
            $profile->id,
            'Client submitted KYC profile for verification'
        );

        return redirect()->to(route('client.profile') . '#kyc-section')
            ->with('success', 'Your KYC verification request has been submitted for review.');
    }

    /**
     * Securely stream/view an uploaded KYC document for the owning client.
     */
    public function viewDocument(KycDocument $document): BinaryFileResponse
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        // Strictly verify client ownership
        if ((int) $document->user_id !== (int) $user->id) {
            abort(403, 'Unauthorized access to document.');
        }

        if (!Storage::disk('local')->exists($document->file_path)) {
            abort(404, 'Document file not found.');
        }

        return response()->file(Storage::disk('local')->path($document->file_path));
    }
}
