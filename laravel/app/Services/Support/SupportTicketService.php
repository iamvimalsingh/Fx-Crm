<?php

namespace App\Services\Support;

use App\Models\Deposit;
use App\Models\KycProfile;
use App\Models\SupportAttachment;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\TradingAccount;
use App\Models\TradingAccountFundingRequest;
use App\Models\TradingAccountRequest;
use App\Models\TradingPasswordResetRequest;
use App\Models\User;
use App\Models\Withdrawal;
use App\Services\Audit\AuditLoggerService;
use App\Services\Notification\NotificationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SupportTicketService
{
    /**
     * Create a new support ticket by a client.
     */
    public function createTicket(User $user, array $data, ?UploadedFile $attachment = null): SupportTicket
    {
        // Validate CRM record ownership if linking is requested
        if (!empty($data['linked_record_type']) && !empty($data['linked_record_id'])) {
            if (!$this->validateCrmRecordOwnership($user, $data['linked_record_type'], (int) $data['linked_record_id'])) {
                throw new AuthorizationException('Unauthorized reference: You cannot link a CRM record that does not belong to your account.');
            }
        }

        $ticket = SupportTicket::create([
            'ticket_number' => SupportTicket::generateTicketNumber(),
            'user_id' => $user->id,
            'subject' => $data['subject'],
            'category' => $data['category'],
            'priority' => $data['priority'] ?? 'normal',
            'status' => 'open',
            'linked_record_type' => $data['linked_record_type'] ?? null,
            'linked_record_id' => $data['linked_record_id'] ?? null,
            'last_reply_at' => now(),
            'last_reply_by_role' => 'client',
        ]);

        $message = SupportMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'sender_role' => 'client',
            'is_internal_note' => false,
            'message' => $data['message'],
        ]);

        if ($attachment) {
            $this->storeAttachment($ticket, $message, $user, $attachment);
        }

        AuditLoggerService::log(
            'support_ticket_created',
            $user,
            SupportTicket::class,
            $ticket->id,
            "Client opened ticket {$ticket->ticket_number}: {$ticket->subject} [Category: {$ticket->category}, Priority: {$ticket->priority}]"
        );

        // Notify Admins
        $admins = User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            NotificationService::notify(
                $admin,
                "New Support Ticket #{$ticket->ticket_number}",
                "Client {$user->email} opened ticket: '{$ticket->subject}' ({$ticket->category})",
                'info',
                route('admin.support.show', $ticket)
            );
        }

        return $ticket;
    }

    /**
     * Post a reply to an existing ticket by the client.
     */
    public function replyFromClient(SupportTicket $ticket, User $user, string $messageText, ?UploadedFile $attachment = null): SupportMessage
    {
        if ($ticket->user_id !== $user->id) {
            throw new AuthorizationException('Unauthorized access to support ticket.');
        }

        if ($ticket->status === 'closed') {
            throw ValidationException::withMessages([
                'message' => 'This ticket is closed. Please reopen it or create a new ticket to continue conversation.',
            ]);
        }

        // Resolved tickets are automatically reopened on client reply
        $reopened = false;
        if ($ticket->status === 'resolved') {
            $ticket->status = 'open';
            $ticket->resolved_at = null;
            $reopened = true;
        } elseif ($ticket->status === 'pending') {
            $ticket->status = 'open';
        }

        $ticket->last_reply_at = now();
        $ticket->last_reply_by_role = 'client';
        $ticket->save();

        $message = SupportMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'sender_role' => 'client',
            'is_internal_note' => false,
            'message' => $messageText,
        ]);

        if ($attachment) {
            $this->storeAttachment($ticket, $message, $user, $attachment);
        }

        AuditLoggerService::log(
            'support_ticket_client_reply',
            $user,
            SupportTicket::class,
            $ticket->id,
            "Client replied on ticket {$ticket->ticket_number}" . ($reopened ? ' (Ticket automatically reopened)' : '')
        );

        // Notify Assigned Admin or all Admins
        if ($ticket->assignedTo) {
            NotificationService::notify(
                $ticket->assignedTo,
                "Support Reply on #{$ticket->ticket_number}",
                "Client {$user->email} replied to ticket: '{$ticket->subject}'",
                'info',
                route('admin.support.show', $ticket)
            );
        } else {
            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                NotificationService::notify(
                    $admin,
                    "Support Reply on #{$ticket->ticket_number}",
                    "Client {$user->email} replied to ticket: '{$ticket->subject}'",
                    'info',
                    route('admin.support.show', $ticket)
                );
            }
        }

        return $message;
    }

    /**
     * Post a reply to an existing ticket by an admin.
     */
    public function replyFromAdmin(
        SupportTicket $ticket,
        User $admin,
        string $messageText,
        ?UploadedFile $attachment = null,
        ?string $newStatus = null
    ): SupportMessage {
        if (!$admin->isAdmin()) {
            throw new AuthorizationException('Only administrators can post support replies.');
        }

        $message = SupportMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $admin->id,
            'sender_role' => 'admin',
            'is_internal_note' => false,
            'message' => $messageText,
        ]);

        if ($attachment) {
            $this->storeAttachment($ticket, $message, $admin, $attachment);
        }

        $ticket->last_reply_at = now();
        $ticket->last_reply_by_role = 'admin';

        if ($newStatus && in_array($newStatus, array_keys(SupportTicket::STATUSES), true)) {
            $ticket->status = $newStatus;
            if ($newStatus === 'resolved') {
                $ticket->resolved_at = now();
            } elseif ($newStatus === 'closed') {
                $ticket->closed_at = now();
            }
        } elseif ($ticket->status === 'open') {
            $ticket->status = 'pending'; // Waiting on client response
        }

        $ticket->save();

        AuditLoggerService::log(
            'support_ticket_admin_reply',
            $admin,
            SupportTicket::class,
            $ticket->id,
            "Admin replied on ticket {$ticket->ticket_number} (Status: {$ticket->status})"
        );

        // Notify Client
        NotificationService::notify(
            $ticket->user,
            "Support Response: #{$ticket->ticket_number}",
            "Our support team has replied to your inquiry: '{$ticket->subject}'",
            'info',
            route('client.support.show', $ticket)
        );

        return $message;
    }

    /**
     * Add an internal note visible only to administrators.
     */
    public function addInternalNote(SupportTicket $ticket, User $admin, string $noteText, ?UploadedFile $attachment = null): SupportMessage
    {
        if (!$admin->isAdmin()) {
            throw new AuthorizationException('Only administrators can post internal notes.');
        }

        $message = SupportMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $admin->id,
            'sender_role' => 'admin',
            'is_internal_note' => true,
            'message' => $noteText,
        ]);

        if ($attachment) {
            $this->storeAttachment($ticket, $message, $admin, $attachment);
        }

        AuditLoggerService::log(
            'support_ticket_internal_note',
            $admin,
            SupportTicket::class,
            $ticket->id,
            "Admin posted internal note on ticket {$ticket->ticket_number}"
        );

        return $message;
    }

    /**
     * Update status of a support ticket.
     */
    public function updateStatus(SupportTicket $ticket, User $actor, string $newStatus): void
    {
        if (!in_array($newStatus, array_keys(SupportTicket::STATUSES), true)) {
            throw new \InvalidArgumentException('Invalid ticket status provided.');
        }

        $oldStatus = $ticket->status;
        $ticket->status = $newStatus;

        if ($newStatus === 'resolved') {
            $ticket->resolved_at = now();
        } elseif ($newStatus === 'closed') {
            $ticket->closed_at = now();
        } elseif ($newStatus === 'open' && in_array($oldStatus, ['resolved', 'closed'], true)) {
            $ticket->resolved_at = null;
            $ticket->closed_at = null;
        }

        $ticket->save();

        $roleName = $actor->role instanceof \App\Enums\UserRole ? $actor->role->value : (string)$actor->role;

        AuditLoggerService::log(
            'support_ticket_status_updated',
            $actor,
            SupportTicket::class,
            $ticket->id,
            "Ticket {$ticket->ticket_number} status changed from {$oldStatus} to {$newStatus} by {$roleName}"
        );

        // Notify client if admin changed status to resolved or closed
        if ($actor->isAdmin()) {
            if ($newStatus === 'resolved') {
                NotificationService::notify(
                    $ticket->user,
                    "Support Ticket Resolved: #{$ticket->ticket_number}",
                    "Your support ticket '{$ticket->subject}' has been marked as resolved.",
                    'success',
                    route('client.support.show', $ticket)
                );
            } elseif ($newStatus === 'closed') {
                NotificationService::notify(
                    $ticket->user,
                    "Support Ticket Closed: #{$ticket->ticket_number}",
                    "Your support ticket '{$ticket->subject}' has been closed.",
                    'warning',
                    route('client.support.show', $ticket)
                );
            }
        } elseif (!$actor->isAdmin() && $newStatus === 'open') {
            // Client reopened ticket
            $admins = User::whereIn('role', [\App\Enums\UserRole::ADMIN->value, \App\Enums\UserRole::SUPER_ADMIN->value])->get();
            foreach ($admins as $admin) {
                NotificationService::notify(
                    $admin,
                    "Support Ticket Reopened: #{$ticket->ticket_number}",
                    "Client {$actor->email} reopened ticket: '{$ticket->subject}'",
                    'info',
                    route('admin.support.show', $ticket)
                );
            }
        }
    }

    /**
     * Update priority of a support ticket.
     */
    public function updatePriority(SupportTicket $ticket, User $admin, string $newPriority): void
    {
        if (!$admin->isAdmin()) {
            throw new AuthorizationException('Only administrators can update ticket priority.');
        }

        if (!in_array($newPriority, array_keys(SupportTicket::PRIORITIES), true)) {
            throw new \InvalidArgumentException('Invalid priority provided.');
        }

        $oldPriority = $ticket->priority;
        $ticket->priority = $newPriority;
        $ticket->save();

        AuditLoggerService::log(
            'support_ticket_priority_updated',
            $admin,
            SupportTicket::class,
            $ticket->id,
            "Ticket {$ticket->ticket_number} priority updated from {$oldPriority} to {$newPriority}"
        );
    }

    /**
     * Assign ticket to an admin agent.
     */
    public function assignTicket(SupportTicket $ticket, User $admin, ?int $assignedToUserId): void
    {
        if (!$admin->isAdmin()) {
            throw new AuthorizationException('Only administrators can assign support tickets.');
        }

        $assignedUser = null;
        if ($assignedToUserId !== null) {
            $assignedUser = User::where('role', 'admin')->find($assignedToUserId);
            if (!$assignedUser) {
                throw new \InvalidArgumentException('Assigned user must be an active administrator.');
            }
        }

        $ticket->assigned_to_user_id = $assignedUser?->id;
        $ticket->save();

        AuditLoggerService::log(
            'support_ticket_assigned',
            $admin,
            SupportTicket::class,
            $ticket->id,
            "Ticket {$ticket->ticket_number} assigned to " . ($assignedUser ? $assignedUser->email : 'Unassigned')
        );

        if ($assignedUser && $assignedUser->id !== $admin->id) {
            NotificationService::notify(
                $assignedUser,
                "Ticket Assigned: #{$ticket->ticket_number}",
                "Administrator {$admin->name} assigned support ticket '{$ticket->subject}' to you.",
                'info',
                route('admin.support.show', $ticket)
            );
        }
    }

    /**
     * Validate whether the user owns the referenced CRM record.
     */
    public function validateCrmRecordOwnership(User $user, string $type, int $id): bool
    {
        return match ($type) {
            'deposit' => Deposit::where('user_id', $user->id)->where('id', $id)->exists(),
            'withdrawal' => Withdrawal::where('user_id', $user->id)->where('id', $id)->exists(),
            'trading_account' => TradingAccount::where('user_id', $user->id)->where('id', $id)->exists(),
            'trading_account_request' => TradingAccountRequest::where('user_id', $user->id)->where('id', $id)->exists(),
            'trading_password_reset' => TradingPasswordResetRequest::where('user_id', $user->id)->where('id', $id)->exists(),
            'trading_funding_request' => TradingAccountFundingRequest::where('user_id', $user->id)->where('id', $id)->exists(),
            'kyc' => KycProfile::where('user_id', $user->id)->where('id', $id)->exists(),
            default => false,
        };
    }

    /**
     * Securely store an attachment outside the public web root.
     */
    private function storeAttachment(
        SupportTicket $ticket,
        SupportMessage $message,
        User $user,
        UploadedFile $file
    ): SupportAttachment {
        // Save to local private storage: storage/app/support_attachments/
        $storedPath = $file->store('support_attachments', 'local');

        return SupportAttachment::create([
            'ticket_id' => $ticket->id,
            'message_id' => $message->id,
            'user_id' => $user->id,
            'disk' => 'local',
            'file_path' => $storedPath,
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType() ?? 'application/octet-stream',
            'file_size' => $file->getSize(),
        ]);
    }
}
