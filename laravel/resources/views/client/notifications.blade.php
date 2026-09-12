@extends('layouts.client')

@section('title', 'Notifications')
@section('header_title', 'In-App Notifications')

@section('content')
<div class="row justify-content-center">
    <div class="col-12 col-xl-10">
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
                <h4 class="text-white fw-bold mb-1">Notifications</h4>
                <p class="text-muted small mb-0">System updates, status changes, and operation alerts.</p>
            </div>

            @if($unreadCount > 0)
                <form method="POST" action="{{ route('client.notifications.readAll') }}">
                    @csrf
                    <button type="submit" class="btn btn-sm btn-outline-secondary text-light">
                        <i class="bi bi-check2-all me-1"></i> Mark All as Read ({{ $unreadCount }})
                    </button>
                </form>
            @endif
        </div>

        <div class="fx-card">
            @if($notifications->isEmpty())
                <div class="text-center py-5">
                    <div class="bg-dark bg-opacity-50 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 64px; height: 64px;">
                        <i class="bi bi-bell-slash text-muted fs-3"></i>
                    </div>
                    <h6 class="text-white fw-bold mb-1">No Notifications</h6>
                    <p class="text-muted small mb-0">You do not have any notifications at this time.</p>
                </div>
            @else
                <div class="list-group list-group-flush bg-transparent">
                    @foreach($notifications as $notification)
                        @php
                            $data = $notification->data;
                            $isUnread = is_null($notification->read_at);
                            $type = $data['type'] ?? 'info';
                            $title = $data['title'] ?? 'Notification';
                            $message = $data['message'] ?? '';
                            $actionUrl = $data['action_url'] ?? null;

                            $iconClass = match($type) {
                                'deposit_approved', 'trading_account_approved', 'kyc_approved', 'withdrawal_completed', 'trading_funding_completed', 'trading_password_reset_completed' => 'bi-check-circle-fill text-success',
                                'deposit_rejected', 'withdrawal_rejected', 'trading_account_rejected', 'trading_funding_rejected', 'trading_password_reset_rejected', 'kyc_rejected' => 'bi-x-circle-fill text-danger',
                                default => 'bi-info-circle-fill text-primary',
                            };
                        @endphp
                        <div class="list-group-item bg-transparent border-secondary border-opacity-25 px-0 py-3 d-flex gap-3 align-items-start {{ $isUnread ? 'border-start border-primary border-3 ps-3' : '' }}">
                            <div class="fs-4 flex-shrink-0 mt-1">
                                <i class="bi {{ $iconClass }}"></i>
                            </div>

                            <div class="flex-grow-1 min-w-0">
                                <div class="d-flex justify-content-between align-items-center mb-1 gap-2">
                                    <div class="d-flex align-items-center gap-2">
                                        <h6 class="text-white fw-bold mb-0 text-truncate" style="font-size: 0.95rem;">
                                            {{ $title }}
                                        </h6>
                                        @if($isUnread)
                                            <span class="badge bg-primary bg-opacity-25 text-primary" style="font-size: 0.65rem;">New</span>
                                        @endif
                                    </div>
                                    <span class="text-muted small flex-shrink-0" style="font-size: 0.75rem;">
                                        {{ $notification->created_at->diffForHumans() }}
                                    </span>
                                </div>

                                <p class="text-secondary small mb-2" style="font-size: 0.85rem; line-height: 1.4;">
                                    {{ $message }}
                                </p>

                                <div class="d-flex align-items-center gap-3">
                                    @if($actionUrl)
                                        <a href="{{ $actionUrl }}" class="btn btn-sm btn-link text-primary p-0 text-decoration-none fw-semibold" style="font-size: 0.8rem;">
                                            View Details &rarr;
                                        </a>
                                    @endif

                                    @if($isUnread)
                                        <form method="POST" action="{{ route('client.notifications.read', $notification->id) }}" class="d-inline">
                                            @csrf
                                            <button type="submit" class="btn btn-sm btn-link text-muted p-0 text-decoration-none" style="font-size: 0.8rem;">
                                                <i class="bi bi-check2 me-1"></i>Mark as Read
                                            </button>
                                        </form>
                                    @endif
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>

                @if($notifications->hasPages())
                    <div class="mt-4 pt-3 border-top border-secondary border-opacity-25">
                        {{ $notifications->links() }}
                    </div>
                @endif
            @endif
        </div>
    </div>
</div>
@endsection
