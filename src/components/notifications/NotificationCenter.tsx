import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ShieldAlert,
  FileCheck,
  Wallet,
  Layers,
  HelpCircle,
  ExternalLink,
  X,
  RefreshCw,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  onNavigate?: (tab: string, contextId?: string) => void;
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications?limit=25', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.status === 'success' && data.data) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unread_count || 0);
      }
    } catch {
      // ignore transient errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!token) return;
    setMarkingId(id);
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notification_id: id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token || unreadCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (!onNavigate) return;

    // Deep link routing based on real CRM event type
    switch (item.type) {
      case 'kyc_status':
        onNavigate('kyc');
        break;
      case 'support_ticket':
        onNavigate('support', item.data?.ticket_id);
        break;
      case 'deposit_status':
      case 'withdrawal_status':
        onNavigate('wallet');
        break;
      case 'trading_account':
        onNavigate('accounts');
        break;
      default:
        break;
    }
    setIsOpen(false);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'kyc_status':
        return <FileCheck className="w-4 h-4 text-amber-400" />;
      case 'deposit_status':
      case 'withdrawal_status':
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      case 'trading_account':
        return <Layers className="w-4 h-4 text-blue-400" />;
      case 'support_ticket':
        return <HelpCircle className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <button
        id="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative w-8 h-8 rounded-full bg-[#182030] hover:bg-[#222c42] border border-[#26334d] flex items-center justify-center text-slate-300 transition"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0b0e14]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#121824] border border-[#26334d] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="p-3.5 border-b border-[#26334d] bg-[#182030] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  id="mark-all-notifications-btn"
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body List */}
          <div className="overflow-y-auto flex-grow divide-y divide-[#1e293b]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">No notifications yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Updates on KYC, deposits, tickets, and trading accounts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 transition cursor-pointer flex items-start gap-3 text-left ${
                    item.is_read
                      ? 'bg-transparent hover:bg-[#182030]/50'
                      : 'bg-[#182030]/80 hover:bg-[#182030] border-l-2 border-blue-500'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-[#0b0e14] border border-[#26334d] flex-shrink-0 mt-0.5">
                    {getIconForType(item.type)}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          item.is_read ? 'text-slate-300 font-medium' : 'text-white font-bold'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-blue-400 flex items-center gap-1 font-medium hover:underline">
                        <span>View details</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>

                      {!item.is_read && (
                        <button
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          disabled={markingId === item.id}
                          className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[#0b0e14] border-t border-[#26334d] text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              Live updates via Netlify Functions backend
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
