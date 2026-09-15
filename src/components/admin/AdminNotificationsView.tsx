import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Send,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Users,
  User,
  Info,
  RefreshCw,
} from 'lucide-react';

export function AdminNotificationsView() {
  const { token } = useAuth();
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [noticeType, setNoticeType] = useState<'system' | 'compliance' | 'security' | 'market'>('system');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!title.trim() || !message.trim()) {
      setStatusFeedback({ type: 'error', text: 'Title and message are required.' });
      return;
    }
    if (targetType === 'specific' && !targetUserId.trim()) {
      setStatusFeedback({ type: 'error', text: 'Specific Client ID is required.' });
      return;
    }

    setSending(true);
    setStatusFeedback(null);

    try {
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type: noticeType,
          target: targetType,
          user_id: targetType === 'specific' ? targetUserId.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to dispatch broadcast notice');

      setStatusFeedback({
        type: 'success',
        text: `Notice successfully dispatched to ${json.data.recipient_count} client(s). Recorded in audit trail.`,
      });
      setTitle('');
      setMessage('');
      if (targetType === 'specific') setTargetUserId('');
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'Broadcast transmission failed' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Client Communications & Broadcasts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dispatch operational alerts, compliance reminders, or urgent notifications to traders.
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
          <Bell className="w-4 h-4" />
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {statusFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* Broadcast Composer Form */}
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl p-6 shadow-xl">
        <form onSubmit={handleBroadcast} className="space-y-5 text-xs">
          {/* Target Audience */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
              Target Recipient Audience
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2.5 transition ${
                  targetType === 'all'
                    ? 'bg-purple-600/10 border-purple-500/50 text-white'
                    : 'bg-[#07090e] border-[#1b222d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                  className="hidden"
                />
                <Users className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="font-semibold text-xs">Broadcast All Clients</div>
                  <div className="text-[10px] text-slate-500">Deliver to all registered trader inboxes</div>
                </div>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2.5 transition ${
                  targetType === 'specific'
                    ? 'bg-purple-600/10 border-purple-500/50 text-white'
                    : 'bg-[#07090e] border-[#1b222d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  checked={targetType === 'specific'}
                  onChange={() => setTargetType('specific')}
                  className="hidden"
                />
                <User className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="font-semibold text-xs">Specific Client Account</div>
                  <div className="text-[10px] text-slate-500">Target a single user by client UUID</div>
                </div>
              </label>
            </div>
          </div>

          {targetType === 'specific' && (
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Client User UUID
              </label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="e.g., 00000000-0000-0000-0000-000000000000"
                className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white font-mono outline-none focus:border-purple-500/50 text-xs"
              />
            </div>
          )}

          {/* Notice Category */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notice Category</label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value as any)}
                className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50 text-xs"
              >
                <option value="system">System Notice</option>
                <option value="compliance">KYC & Compliance</option>
                <option value="security">Security Advisory</option>
                <option value="market">Market Schedule</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notice Headline</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Scheduled MT5 Weekend Maintenance..."
                className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50 text-xs"
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notification Body</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter the full operational bulletin or notification text that traders will see in their notification center..."
              className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg p-3 text-white outline-none focus:border-purple-500/50 text-xs leading-relaxed"
            />
          </div>

          {/* Action button */}
          <div className="pt-2 flex items-center justify-between border-t border-[#1b222d]">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Broadcasts will appear in client in-app notification centers immediately.</span>
            </div>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50 shadow-lg shadow-purple-600/20 text-xs"
            >
              {sending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Transmitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Notification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
