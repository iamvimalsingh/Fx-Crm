<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Deposit;
use App\Models\Setting;
use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\TradingAccount;
use App\Models\User;
use App\Models\UserProfile;
use App\Models\Wallet;
use App\Services\Support\SupportTicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SupportCenterTest extends TestCase
{
    use RefreshDatabase;

    private User $client;
    private User $otherClient;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->create(['role' => 'client']);
        UserProfile::create([
            'user_id' => $this->client->id,
            'first_name' => 'Alice',
            'last_name' => 'Trader',
        ]);
        Wallet::create([
            'user_id' => $this->client->id,
            'currency' => 'USD',
            'balance' => '1500.00',
        ]);

        $this->otherClient = User::factory()->create(['role' => 'client']);
        UserProfile::create([
            'user_id' => $this->otherClient->id,
            'first_name' => 'Bob',
            'last_name' => 'Smith',
        ]);
        Wallet::create([
            'user_id' => $this->otherClient->id,
            'currency' => 'USD',
            'balance' => '500.00',
        ]);

        $this->admin = User::factory()->create(['role' => 'admin']);
        UserProfile::create([
            'user_id' => $this->admin->id,
            'first_name' => 'Admin',
            'last_name' => 'Support',
        ]);
    }

    public function test_client_can_view_support_center_with_dynamic_settings(): void
    {
        Setting::set('SUPPORT_EMAIL', 'helpdesk@broker-custom.com');
        Setting::set('SUPPORT_PHONE', '+1 (800) 999-8877');

        $response = $this->actingAs($this->client)->get(route('client.support.index'));

        $response->assertOk();
        $response->assertSee('helpdesk@broker-custom.com');
        $response->assertSee('+1 (800) 999-8877');
        $response->assertSee('Client Support Center');
    }

    public function test_client_can_view_create_ticket_form(): void
    {
        $response = $this->actingAs($this->client)->get(route('client.support.create'));

        $response->assertOk();
        $response->assertSee('Open a Support Ticket');
        $response->assertSee('Deposit');
        $response->assertSee('Withdrawal');
        $response->assertSee('Trading Account');
    }

    public function test_client_can_create_ticket_with_valid_data(): void
    {
        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => 'Issue with MT5 login credentials',
            'category' => 'Trading Account',
            'priority' => 'normal',
            'message' => 'I cannot log in to the trading terminal with the provided credentials.',
        ]);

        $ticket = SupportTicket::first();
        $this->assertNotNull($ticket);
        $this->assertEquals($this->client->id, $ticket->user_id);
        $this->assertEquals('Issue with MT5 login credentials', $ticket->subject);
        $this->assertEquals('Trading Account', $ticket->category);
        $this->assertEquals('open', $ticket->status);
        $this->assertStringStartsWith('TKT-', $ticket->ticket_number);

        $response->assertRedirect(route('client.support.show', $ticket));
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('support_messages', [
            'ticket_id' => $ticket->id,
            'user_id' => $this->client->id,
            'sender_role' => 'client',
            'is_internal_note' => false,
        ]);
    }

    public function test_client_can_create_ticket_with_attachment(): void
    {
        Storage::fake('local');

        $file = UploadedFile::fake()->create('screenshot.png', 500, 'image/png');

        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => 'Screenshot of terminal error',
            'category' => 'Technical',
            'priority' => 'high',
            'message' => 'Please see the attached screenshot showing the timeout error.',
            'attachment' => $file,
        ]);

        $ticket = SupportTicket::first();
        $this->assertNotNull($ticket);

        $attachment = SupportAttachment::where('ticket_id', $ticket->id)->first();
        $this->assertNotNull($attachment);
        $this->assertEquals('screenshot.png', $attachment->file_name);
        Storage::disk('local')->assertExists($attachment->file_path);

        $response->assertRedirect(route('client.support.show', $ticket));
    }

    public function test_client_cannot_create_ticket_with_invalid_data(): void
    {
        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => '',
            'category' => 'InvalidCategory',
            'priority' => 'invalid_priority',
            'message' => '',
        ]);

        $response->assertSessionHasErrors(['subject', 'category', 'priority', 'message']);
        $this->assertEquals(0, SupportTicket::count());
    }

    public function test_client_can_link_own_crm_record(): void
    {
        $deposit = Deposit::create([
            'user_id' => $this->client->id,
            'currency' => 'USD',
            'amount' => '250.00',
            'fee' => '0.00',
            'net_amount' => '250.00',
            'status' => 'pending',
            'payment_method_code' => 'bank_wire',
        ]);

        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => 'Pending deposit status inquiry',
            'category' => 'Deposit',
            'priority' => 'normal',
            'message' => 'When will my bank wire deposit be credited?',
            'linked_record_type' => 'deposit',
            'linked_record_id' => $deposit->id,
        ]);

        $ticket = SupportTicket::first();
        $this->assertNotNull($ticket);
        $this->assertEquals('deposit', $ticket->linked_record_type);
        $this->assertEquals($deposit->id, $ticket->linked_record_id);

        $response->assertRedirect(route('client.support.show', $ticket));
    }

    public function test_client_cannot_link_another_clients_crm_record(): void
    {
        // Deposit belonging to Bob
        $otherDeposit = Deposit::create([
            'user_id' => $this->otherClient->id,
            'currency' => 'USD',
            'amount' => '1000.00',
            'fee' => '0.00',
            'net_amount' => '1000.00',
            'status' => 'pending',
            'payment_method_code' => 'crypto',
        ]);

        // Alice tries to link Bob's deposit
        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => 'Fraudulent attempt to link other deposit',
            'category' => 'Deposit',
            'priority' => 'normal',
            'message' => 'Attempting IDOR reference.',
            'linked_record_type' => 'deposit',
            'linked_record_id' => $otherDeposit->id,
        ]);

        $response->assertSessionHasErrors(['linked_record_id']);
        $this->assertEquals(0, SupportTicket::count());
    }

    public function test_client_can_view_own_ticket_thread(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Account verification question',
            'category' => 'KYC',
            'priority' => 'normal',
            'message' => 'How long does document verification take?',
        ]);

        $response = $this->actingAs($this->client)->get(route('client.support.show', $ticket));

        $response->assertOk();
        $response->assertSee($ticket->ticket_number);
        $response->assertSee('How long does document verification take?');
    }

    public function test_client_cannot_view_another_clients_ticket(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->otherClient, [
            'subject' => 'Bob Private Ticket',
            'category' => 'General',
            'priority' => 'low',
            'message' => 'Bob private message content.',
        ]);

        $response = $this->actingAs($this->client)->get(route('client.support.show', $ticket));

        $response->assertForbidden();
    }

    public function test_client_can_reply_to_own_open_ticket(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Funding inquiry',
            'category' => 'Trading Funding',
            'priority' => 'normal',
            'message' => 'Initial inquiry text.',
        ]);

        $response = $this->actingAs($this->client)->post(route('client.support.reply', $ticket), [
            'message' => 'Follow up: here is more information about the funding transfer.',
        ]);

        $response->assertRedirect(route('client.support.show', $ticket));
        $this->assertEquals(2, $ticket->messages()->count());

        $latest = $ticket->messages()->latest('id')->first();
        $this->assertEquals('Follow up: here is more information about the funding transfer.', $latest->message);
        $this->assertEquals('client', $latest->sender_role);
    }

    public function test_client_cannot_reply_to_another_clients_ticket(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->otherClient, [
            'subject' => 'Bob Ticket',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Bob message.',
        ]);

        $response = $this->actingAs($this->client)->post(route('client.support.reply', $ticket), [
            'message' => 'Unauthorized reply attempt.',
        ]);

        $response->assertForbidden();
        $this->assertEquals(1, $ticket->messages()->count());
    }

    public function test_client_cannot_reply_to_closed_ticket_without_reopening(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Closed Ticket',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Initial message.',
        ]);
        $ticket->status = 'closed';
        $ticket->save();

        $response = $this->actingAs($this->client)->post(route('client.support.reply', $ticket), [
            'message' => 'Attempt reply on closed ticket.',
        ]);

        $response->assertSessionHasErrors(['message']);
        $this->assertEquals(1, $ticket->messages()->count());
    }

    public function test_client_can_reopen_closed_ticket(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Ticket to reopen',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Initial message.',
        ]);
        $ticket->status = 'closed';
        $ticket->save();

        $response = $this->actingAs($this->client)->post(route('client.support.reopen', $ticket));

        $response->assertRedirect(route('client.support.show', $ticket));
        $ticket->refresh();
        $this->assertEquals('open', $ticket->status);
    }

    public function test_client_reply_automatically_reopens_resolved_ticket(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Resolved issue needing more help',
            'category' => 'Technical',
            'priority' => 'normal',
            'message' => 'Initial issue.',
        ]);
        $ticket->status = 'resolved';
        $ticket->resolved_at = now();
        $ticket->save();

        $response = $this->actingAs($this->client)->post(route('client.support.reply', $ticket), [
            'message' => 'The issue actually happened again, please reopen.',
        ]);

        $response->assertRedirect(route('client.support.show', $ticket));
        $ticket->refresh();
        $this->assertEquals('open', $ticket->status);
        $this->assertNull($ticket->resolved_at);
    }

    public function test_internal_notes_are_never_rendered_or_leaked_to_client(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Withdrawal delay issue',
            'category' => 'Withdrawal',
            'priority' => 'high',
            'message' => 'Where is my wire transfer?',
        ]);

        // Admin adds internal staff note containing sensitive data
        $service->addInternalNote($ticket, $this->admin, 'CONFIDENTIAL_FRAUD_CHECK_PASSED_WAITING_ON_BANK_GATEWAY');

        // Client views the ticket
        $response = $this->actingAs($this->client)->get(route('client.support.show', $ticket));

        $response->assertOk();
        $response->assertDontSee('CONFIDENTIAL_FRAUD_CHECK_PASSED_WAITING_ON_BANK_GATEWAY');
        $response->assertDontSee('INTERNAL NOTE');

        // Admin views the ticket
        $adminResponse = $this->actingAs($this->admin)->get(route('admin.support.show', $ticket));
        $adminResponse->assertOk();
        $adminResponse->assertSee('CONFIDENTIAL_FRAUD_CHECK_PASSED_WAITING_ON_BANK_GATEWAY');
        $adminResponse->assertSee('INTERNAL NOTE');
    }

    public function test_admin_can_view_tickets_list_and_filter(): void
    {
        $service = app(SupportTicketService::class);
        $ticket1 = $service->createTicket($this->client, [
            'subject' => 'Deposit inquiry',
            'category' => 'Deposit',
            'priority' => 'normal',
            'message' => 'Message 1',
        ]);
        $ticket2 = $service->createTicket($this->otherClient, [
            'subject' => 'Technical issue',
            'category' => 'Technical',
            'priority' => 'high',
            'message' => 'Message 2',
        ]);

        $response = $this->actingAs($this->admin)->get(route('admin.support.index'));

        $response->assertOk();
        $response->assertSee($ticket1->ticket_number);
        $response->assertSee($ticket2->ticket_number);

        // Filter by category Deposit
        $filterResponse = $this->actingAs($this->admin)->get(route('admin.support.index', ['category' => 'Deposit']));
        $filterResponse->assertOk();
        $filterResponse->assertSee($ticket1->ticket_number);
        $filterResponse->assertDontSee($ticket2->ticket_number);
    }

    public function test_admin_can_reply_to_ticket_and_notifies_client(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Need password assistance',
            'category' => 'Trading Password',
            'priority' => 'normal',
            'message' => 'Need help resetting trading password.',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.support.reply', $ticket), [
            'message' => 'Hello Alice, we have generated new credentials for your demo account.',
            'new_status' => 'pending',
        ]);

        $response->assertRedirect(route('admin.support.show', $ticket));
        $ticket->refresh();
        $this->assertEquals('pending', $ticket->status);
        $this->assertEquals('admin', $ticket->last_reply_by_role);

        // Client has notification
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $this->client->id,
            'type' => 'App\Notifications\AppNotification',
        ]);
    }

    public function test_admin_can_post_internal_note(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Internal check ticket',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Initial inquiry.',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.support.note', $ticket), [
            'note' => 'Internal staff note: Escalate to Level 2 finance desk.',
        ]);

        $response->assertRedirect(route('admin.support.show', $ticket));

        $this->assertDatabaseHas('support_messages', [
            'ticket_id' => $ticket->id,
            'is_internal_note' => true,
            'message' => 'Internal staff note: Escalate to Level 2 finance desk.',
        ]);
    }

    public function test_admin_can_update_status_and_priority(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Status change test',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Test message.',
        ]);

        // Change priority to high
        $pResponse = $this->actingAs($this->admin)->post(route('admin.support.priority', $ticket), [
            'priority' => 'high',
        ]);
        $pResponse->assertRedirect(route('admin.support.show', $ticket));
        $ticket->refresh();
        $this->assertEquals('high', $ticket->priority);

        // Change status to resolved
        $sResponse = $this->actingAs($this->admin)->post(route('admin.support.status', $ticket), [
            'status' => 'resolved',
        ]);
        $sResponse->assertRedirect(route('admin.support.show', $ticket));
        $ticket->refresh();
        $this->assertEquals('resolved', $ticket->status);
        $this->assertNotNull($ticket->resolved_at);
    }

    public function test_admin_can_assign_ticket_to_admin(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Assignment test',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Test message.',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.support.assign', $ticket), [
            'assigned_to_user_id' => $this->admin->id,
        ]);

        $response->assertRedirect(route('admin.support.show', $ticket));
        $ticket->refresh();
        $this->assertEquals($this->admin->id, $ticket->assigned_to_user_id);
    }

    public function test_admin_can_update_support_settings(): void
    {
        $response = $this->actingAs($this->admin)->post(route('admin.settings.support'), [
            'support_email' => 'custom-support@arrowtrader.com',
            'support_phone' => '+1 (555) 999-0000',
            'support_whatsapp' => '+1 (555) 999-1111',
            'support_hours' => '24/7 Priority Desk',
            'support_timezone' => 'UTC+2 / EET',
            'support_instructions' => 'Custom helpdesk instructions for traders.',
            'support_emergency' => 'Direct dealing desk phone: +1 (555) 999-2222',
        ]);

        $response->assertRedirect();
        $this->assertEquals('custom-support@arrowtrader.com', Setting::get('SUPPORT_EMAIL'));
        $this->assertEquals('+1 (555) 999-0000', Setting::get('SUPPORT_PHONE'));

        // Client views support index and sees updated details
        $clientView = $this->actingAs($this->client)->get(route('client.support.index'));
        $clientView->assertSee('custom-support@arrowtrader.com');
        $clientView->assertSee('24/7 Priority Desk');
        $clientView->assertSee('Custom helpdesk instructions for traders.');
    }

    public function test_attachment_download_authorization_and_isolation(): void
    {
        Storage::fake('local');
        $file = UploadedFile::fake()->create('contract.pdf', 100, 'application/pdf');

        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Contract verification',
            'category' => 'KYC',
            'priority' => 'normal',
            'message' => 'Signed contract attached.',
        ], $file);

        $attachment = $ticket->attachments()->first();
        $this->assertNotNull($attachment);

        // 1. Client who owns ticket can download
        $dlResponse = $this->actingAs($this->client)->get(route('client.support.attachments.download', $attachment));
        $dlResponse->assertOk();

        // 2. Admin can download
        $adminDlResponse = $this->actingAs($this->admin)->get(route('client.support.attachments.download', $attachment));
        $adminDlResponse->assertOk();

        // 3. Unauthorized other client CANNOT download (403 Forbidden)
        $unauthResponse = $this->actingAs($this->otherClient)->get(route('client.support.attachments.download', $attachment));
        $unauthResponse->assertForbidden();

        // 4. Client cannot download attachment belonging to internal note
        $internalFile = UploadedFile::fake()->create('confidential_note.pdf', 100, 'application/pdf');
        $internalNoteMsg = $service->addInternalNote($ticket, $this->admin, 'Audit log note', $internalFile);
        $internalAttachment = $internalNoteMsg->attachments()->first();

        $clientLeakResponse = $this->actingAs($this->client)->get(route('client.support.attachments.download', $internalAttachment));
        $clientLeakResponse->assertForbidden();
    }

    public function test_audit_logs_recorded_for_support_actions(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Audit log testing',
            'category' => 'Technical',
            'priority' => 'normal',
            'message' => 'Test message.',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'support_ticket_created',
            'target_type' => SupportTicket::class,
            'target_id' => $ticket->id,
        ]);

        $this->actingAs($this->admin)->post(route('admin.support.reply', $ticket), [
            'message' => 'Admin audit test reply',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'support_ticket_admin_reply',
            'target_type' => SupportTicket::class,
            'target_id' => $ticket->id,
        ]);
    }

    public function test_non_admin_cannot_access_admin_support_routes(): void
    {
        $service = app(SupportTicketService::class);
        $ticket = $service->createTicket($this->client, [
            'subject' => 'Access check',
            'category' => 'General',
            'priority' => 'normal',
            'message' => 'Check route security.',
        ]);

        $responseIndex = $this->actingAs($this->client)->get(route('admin.support.index'));
        $responseIndex->assertForbidden();

        $responseShow = $this->actingAs($this->client)->get(route('admin.support.show', $ticket));
        $responseShow->assertForbidden();

        $responseReply = $this->actingAs($this->client)->post(route('admin.support.reply', $ticket), [
            'message' => 'Unauthorized admin reply.',
        ]);
        $responseReply->assertForbidden();
    }

    public function test_kyc_linked_ticket_creation_and_blade_rendering_with_enum_status(): void
    {
        $kycProfile = \App\Models\KycProfile::create([
            'user_id' => $this->client->id,
            'status' => \App\Enums\KycStatus::PENDING,
        ]);

        // 1. Visit support create page where $userKyc is passed with BackedEnum status
        $createPageResponse = $this->actingAs($this->client)->get(route('client.support.create'));
        $createPageResponse->assertOk();
        $createPageResponse->assertSee('KYC Profile — Status: Pending');

        // 2. Create KYC-linked ticket
        $response = $this->actingAs($this->client)->post(route('client.support.store'), [
            'subject' => 'KYC Verification Question',
            'category' => 'KYC',
            'priority' => 'normal',
            'message' => 'Please check my submitted proof of address.',
            'linked_record_type' => 'kyc',
            'linked_record_id' => $kycProfile->id,
        ]);

        $response->assertRedirect();
        $ticket = SupportTicket::where('linked_record_type', 'kyc')->first();
        $this->assertNotNull($ticket);
        $this->assertEquals('KYC Profile (Status: Pending)', $ticket->linked_record_label);

        // 3. Render client support show page
        $clientShow = $this->actingAs($this->client)->get(route('client.support.show', $ticket));
        $clientShow->assertOk();
        $clientShow->assertSee('KYC Profile (Status: Pending)');

        // 4. Render admin support show page
        $adminShow = $this->actingAs($this->admin)->get(route('admin.support.show', $ticket));
        $adminShow->assertOk();
        $adminShow->assertSee('KYC Profile (Status: Pending)');
        $adminShow->assertSee('Pending');
    }

    public function test_format_status_label_helper_handles_enums_strings_and_null(): void
    {
        $this->assertEquals('Pending', SupportTicket::formatStatusLabel(\App\Enums\KycStatus::PENDING));
        $this->assertEquals('Approved', SupportTicket::formatStatusLabel(\App\Enums\KycStatus::APPROVED));
        $this->assertEquals('In review', SupportTicket::formatStatusLabel('in_review'));
        $this->assertEquals('None', SupportTicket::formatStatusLabel(null));
    }
}
