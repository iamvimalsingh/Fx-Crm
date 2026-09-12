<?php

namespace Tests\Feature;

use App\Enums\KycStatus;
use App\Models\AuditLog;
use App\Models\KycDocument;
use App\Models\KycProfile;
use App\Models\User;
use App\Services\Notification\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Phase9MvpCompletenessTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $clientA;
    protected User $clientB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'email' => 'admin9@broker.test',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->clientA = User::factory()->create([
            'email' => 'clientA@broker.test',
            'role' => 'client',
            'status' => 'active',
        ]);

        $this->clientB = User::factory()->create([
            'email' => 'clientB@broker.test',
            'role' => 'client',
            'status' => 'active',
        ]);

        Storage::fake('local');
    }

    /**
     * Test client can upload a KYC document with validation.
     */
    public function test_client_can_upload_kyc_document_with_validation(): void
    {
        // 1. Invalid file extension should fail validation
        $invalidFile = UploadedFile::fake()->create('malicious.exe', 100);
        $response = $this->actingAs($this->clientA)
            ->post(route('client.kyc.document.upload'), [
                'document_type' => 'id_proof',
                'document_file' => $invalidFile,
            ]);
        $response->assertSessionHasErrors('document_file');

        // 2. Valid image upload succeeds
        $validFile = UploadedFile::fake()->create('passport.jpg', 500, 'image/jpeg');
        $response = $this->actingAs($this->clientA)
            ->post(route('client.kyc.document.upload'), [
                'document_type' => 'id_proof',
                'document_file' => $validFile,
            ]);

        $response->assertRedirect(route('client.profile') . '#kyc-section');
        $response->assertSessionHas('success');

        // Assert database record exists
        $this->assertDatabaseHas('kyc_documents', [
            'user_id' => $this->clientA->id,
            'document_type' => 'id_proof',
            'status' => 'pending',
        ]);

        // Assert file stored in private local disk
        $doc = KycDocument::where('user_id', $this->clientA->id)->first();
        $this->assertNotNull($doc);
        Storage::disk('local')->assertExists($doc->file_path);

        // Assert audit log
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'kyc_document_uploaded',
            'user_id' => $this->clientA->id,
        ]);
    }

    /**
     * Test authorization: Client A cannot view Client B's uploaded document, but Admin can.
     */
    public function test_kyc_document_authorization_boundaries(): void
    {
        $file = UploadedFile::fake()->create('id.pdf', 200, 'application/pdf');
        $path = $file->store('kyc_documents', 'local');

        $doc = KycDocument::create([
            'user_id' => $this->clientA->id,
            'document_type' => 'id_proof',
            'file_path' => $path,
            'status' => 'pending',
        ]);

        // Client A can view own document
        $response = $this->actingAs($this->clientA)
            ->get(route('client.kyc.document.view', $doc->id));
        $response->assertOk();

        // Client B is forbidden (403)
        $response = $this->actingAs($this->clientB)
            ->get(route('client.kyc.document.view', $doc->id));
        $response->assertStatus(403);

        // Admin can view document via admin route
        $response = $this->actingAs($this->admin)
            ->get(route('admin.kyc.documents.view', $doc->id));
        $response->assertOk();
    }

    /**
     * Test client submits KYC profile for verification.
     */
    public function test_client_can_submit_kyc_profile(): void
    {
        // Fails if no documents uploaded
        $response = $this->actingAs($this->clientA)
            ->post(route('client.kyc.submit'));
        $response->assertSessionHas('error');

        // Add document
        KycDocument::create([
            'user_id' => $this->clientA->id,
            'document_type' => 'id_proof',
            'file_path' => 'kyc_documents/test.jpg',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->clientA)
            ->post(route('client.kyc.submit'));

        $response->assertRedirect(route('client.profile') . '#kyc-section');
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('kyc_profiles', [
            'user_id' => $this->clientA->id,
            'status' => KycStatus::PENDING->value,
        ]);
    }

    /**
     * Test Admin can approve client KYC profile.
     */
    public function test_admin_can_approve_kyc_profile(): void
    {
        KycProfile::create([
            'user_id' => $this->clientA->id,
            'status' => KycStatus::PENDING->value,
        ]);

        $doc = KycDocument::create([
            'user_id' => $this->clientA->id,
            'document_type' => 'id_proof',
            'file_path' => 'kyc_documents/test.jpg',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.kyc.profiles.approve', $this->clientA->id));

        $response->assertSessionHas('success');

        // Assert profile approved
        $this->assertDatabaseHas('kyc_profiles', [
            'user_id' => $this->clientA->id,
            'status' => KycStatus::APPROVED->value,
        ]);

        // Assert documents approved
        $this->assertDatabaseHas('kyc_documents', [
            'id' => $doc->id,
            'status' => 'approved',
        ]);

        // Assert audit log created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'kyc_profile_approved',
            'user_id' => $this->admin->id,
        ]);

        // Assert notification sent to client
        $this->assertEquals(1, $this->clientA->notifications()->count());
        $notification = $this->clientA->notifications()->first();
        $this->assertEquals('kyc_approved', $notification->data['type']);
    }

    /**
     * Test Admin can reject client KYC profile with rejection reason.
     */
    public function test_admin_can_reject_kyc_profile_with_reason(): void
    {
        KycProfile::create([
            'user_id' => $this->clientA->id,
            'status' => KycStatus::PENDING->value,
        ]);

        // Validation error if reason omitted
        $response = $this->actingAs($this->admin)
            ->post(route('admin.kyc.profiles.reject', $this->clientA->id), [
                'rejection_reason' => '',
            ]);
        $response->assertSessionHasErrors('rejection_reason');

        // Valid rejection
        $response = $this->actingAs($this->admin)
            ->post(route('admin.kyc.profiles.reject', $this->clientA->id), [
                'rejection_reason' => 'Passport photo is blurry and illegible.',
            ]);

        $response->assertSessionHas('success');

        $this->assertDatabaseHas('kyc_profiles', [
            'user_id' => $this->clientA->id,
            'status' => KycStatus::REJECTED->value,
            'rejection_reason' => 'Passport photo is blurry and illegible.',
        ]);

        // Assert notification sent to client
        $notification = $this->clientA->notifications()->latest()->first();
        $this->assertNotNull($notification);
        $this->assertEquals('kyc_rejected', $notification->data['type']);
        $this->assertStringContainsString('Passport photo is blurry', $notification->data['message']);
    }

    /**
     * Test Admin can approve and reject individual KYC documents.
     */
    public function test_admin_can_approve_and_reject_individual_documents(): void
    {
        $doc = KycDocument::create([
            'user_id' => $this->clientA->id,
            'document_type' => 'address_proof',
            'file_path' => 'kyc_documents/bill.pdf',
            'status' => 'pending',
        ]);

        // Approve document
        $this->actingAs($this->admin)
            ->post(route('admin.kyc.documents.approve', $doc->id));

        $this->assertDatabaseHas('kyc_documents', [
            'id' => $doc->id,
            'status' => 'approved',
        ]);

        // Reject document with reason
        $this->actingAs($this->admin)
            ->post(route('admin.kyc.documents.reject', $doc->id), [
                'rejection_reason' => 'Utility bill is older than 3 months.',
            ]);

        $this->assertDatabaseHas('kyc_documents', [
            'id' => $doc->id,
            'status' => 'rejected',
            'rejection_reason' => 'Utility bill is older than 3 months.',
        ]);
    }

    /**
     * Test In-App Notification Center and read receipts.
     */
    public function test_notification_center_and_read_state(): void
    {
        // Generate notifications
        NotificationService::notify(
            $this->clientA,
            'Deposit Credited',
            'Your deposit of $500.00 has been credited.',
            'deposit_approved'
        );

        NotificationService::notify(
            $this->clientA,
            'Account Request Approved',
            'Your MT5 account request has been approved.',
            'account_approved'
        );

        $this->assertEquals(2, $this->clientA->unreadNotifications()->count());

        // Client views notifications
        $response = $this->actingAs($this->clientA)
            ->get(route('client.notifications'));
        $response->assertOk();
        $response->assertSee('Deposit Credited');
        $response->assertSee('Account Request Approved');

        // Mark single notification as read (JSON / AJAX)
        $firstNotification = $this->clientA->unreadNotifications()->first();
        $response = $this->actingAs($this->clientA)
            ->postJson(route('client.notifications.read', $firstNotification->id));
        $response->assertJson(['success' => true]);

        $this->assertEquals(1, $this->clientA->fresh()->unreadNotifications()->count());

        // Mark all as read (JSON / AJAX)
        $response = $this->actingAs($this->clientA)
            ->postJson(route('client.notifications.readAll'));
        $response->assertJson(['success' => true]);

        $this->assertEquals(0, $this->clientA->fresh()->unreadNotifications()->count());
    }
}
