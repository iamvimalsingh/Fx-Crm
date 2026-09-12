<?php

namespace App\Http\Controllers\Admin;

use App\Enums\KycStatus;
use App\Http\Controllers\Controller;
use App\Models\KycDocument;
use App\Models\KycProfile;
use App\Models\User;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class KycController extends Controller
{
    /**
     * Display a listing of KYC submissions.
     */
    public function index(Request $request): View
    {
        $query = KycProfile::with(['user.profile', 'user.kycDocuments']);

        if ($status = $request->input('status')) {
            if (in_array($status, ['pending', 'approved', 'rejected', 'not_submitted'], true)) {
                $query->where('status', $status);
            }
        }

        $profiles = $query->latest('updated_at')->paginate(15)->withQueryString();

        $stats = [
            'total' => KycProfile::count(),
            'pending' => KycProfile::where('status', 'pending')->count(),
            'approved' => KycProfile::where('status', 'approved')->count(),
            'rejected' => KycProfile::where('status', 'rejected')->count(),
        ];

        return view('admin.kyc.index', compact('profiles', 'stats'));
    }

    /**
     * Show detailed KYC information for a specific client.
     */
    public function show(User $client): View
    {
        $client->load(['profile', 'kycProfile', 'kycDocuments']);

        $kycProfile = $client->kycProfile ?? $client->kycProfile()->create([
            'status' => KycStatus::NOT_SUBMITTED->value,
        ]);

        $documents = $client->kycDocuments()->latest()->get();

        return view('admin.kyc.show', compact('client', 'kycProfile', 'documents'));
    }

    /**
     * Approve a client's KYC profile.
     */
    public function approveProfile(Request $request, User $client): RedirectResponse
    {
        $profile = $client->kycProfile;
        if (!$profile) {
            return back()->with('error', 'Client has no KYC profile.');
        }

        $profile->update([
            'status' => KycStatus::APPROVED->value,
            'rejection_reason' => null,
        ]);

        // Also mark all pending documents as approved
        $client->kycDocuments()->where('status', 'pending')->update([
            'status' => 'approved',
            'rejection_reason' => null,
        ]);

        AuditLoggerService::log(
            'kyc_profile_approved',
            auth()->user(),
            KycProfile::class,
            $profile->id,
            "Admin approved KYC verification for client #{$client->id} ({$client->email})"
        );

        NotificationService::notify(
            $client,
            'KYC Verification Approved',
            'Your identity verification documents have been reviewed and approved. Your client account is now fully verified.',
            'kyc_approved',
            route('client.profile')
        );

        return back()->with('success', "KYC profile for client {$client->email} approved.");
    }

    /**
     * Reject a client's KYC profile.
     */
    public function rejectProfile(Request $request, User $client): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $profile = $client->kycProfile;
        if (!$profile) {
            return back()->with('error', 'Client has no KYC profile.');
        }

        $profile->update([
            'status' => KycStatus::REJECTED->value,
            'rejection_reason' => $validated['rejection_reason'],
        ]);

        AuditLoggerService::log(
            'kyc_profile_rejected',
            auth()->user(),
            KycProfile::class,
            $profile->id,
            "Admin rejected KYC verification for client #{$client->id}: {$validated['rejection_reason']}"
        );

        NotificationService::notify(
            $client,
            'KYC Verification Rejected',
            "Your identity verification request was rejected. Reason: {$validated['rejection_reason']}. Please update your documents and resubmit.",
            'kyc_rejected',
            route('client.profile')
        );

        return back()->with('success', "KYC profile for client {$client->email} rejected.");
    }

    /**
     * Approve an individual KYC document.
     */
    public function approveDocument(KycDocument $document): RedirectResponse
    {
        $document->update([
            'status' => 'approved',
            'rejection_reason' => null,
        ]);

        AuditLoggerService::log(
            'kyc_document_approved',
            auth()->user(),
            KycDocument::class,
            $document->id,
            "Admin approved {$document->document_type} for client #{$document->user_id}"
        );

        return back()->with('success', ucfirst(str_replace('_', ' ', $document->document_type)) . ' approved.');
    }

    /**
     * Reject an individual KYC document.
     */
    public function rejectDocument(Request $request, KycDocument $document): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $document->update([
            'status' => 'rejected',
            'rejection_reason' => $validated['rejection_reason'],
        ]);

        AuditLoggerService::log(
            'kyc_document_rejected',
            auth()->user(),
            KycDocument::class,
            $document->id,
            "Admin rejected {$document->document_type} for client #{$document->user_id}: {$validated['rejection_reason']}"
        );

        return back()->with('success', ucfirst(str_replace('_', ' ', $document->document_type)) . ' marked as rejected.');
    }

    /**
     * Securely stream/view an uploaded document for administrators.
     */
    public function viewDocument(KycDocument $document): BinaryFileResponse
    {
        if (!Storage::disk('local')->exists($document->file_path)) {
            abort(404, 'Document file not found.');
        }

        return response()->file(Storage::disk('local')->path($document->file_path));
    }
}
