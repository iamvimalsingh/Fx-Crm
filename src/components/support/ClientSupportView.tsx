import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBrokerSettings } from '../../context/BrokerSettingsContext';
import {
  HelpCircle,
  PlusCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Send,
  ArrowLeft,
  X,
  FileText,
  Download,
  RefreshCw,
  Search,
  Eye,
  Shield,
  User,
  Mail,
  Phone,
} from 'lucide-react';

interface TicketListItem {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_client' | 'resolved' | 'closed';
  last_reply_at: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessageItem {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'client' | 'admin' | 'system';
  is_internal: boolean;
  message: string;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  attachments?: Array<{
    id: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    storage_key: string;
  }>;
}

interface TicketDetail {
  ticket: TicketListItem;
  messages: TicketMessageItem[];
}

interface ClientSupportViewProps {
  initialTicketId?: string;
}

export function ClientSupportView({ initialTicketId }: ClientSupportViewProps) {
  const { token, user } = useAuth();
  const { branding } = useBrokerSettings();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId || null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New ticket form
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ original_filename: string; mime_type: string; file_size: number; file_base64: string }>
  >([]);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Reply form
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<
    Array<{ original_filename: string; mime_type: string; file_size: number; file_base64: string }>
  >([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Document preview
  const [previewDoc, setPreviewDoc] = useState<{ url: string; mimeType: string; filename: string } | null>(null);

  const fetchTickets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/support/tickets?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.status === 'success' && json.data) {
        setTickets(json.data.tickets || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetail = async (ticketId: string) => {
    if (!token) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.status === 'success' && json.data) {
        const raw = json.data;
        const normalized: TicketDetail = {
          ticket: raw.ticket || {
            id: raw.id || '',
            ticket_number: raw.ticket_number || raw.ticket_no || '',
            user_id: raw.user_id || '',
            subject: raw.subject || '',
            category: raw.category || 'general',
            priority: raw.priority || 'medium',
            status: raw.status || 'open',
            last_reply_at: raw.last_reply_at || raw.created_at || '',
            created_at: raw.created_at || '',
            updated_at: raw.updated_at || '',
          },
          messages: raw.messages || raw.ticket?.messages || [],
        };
        setTicketDetail(normalized);
        setActiveTab('detail');
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to load ticket details' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading ticket' });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    if (initialTicketId) {
      fetchTicketDetail(initialTicketId);
    }
  }, [token, initialTicketId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isReply = false) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Attachment must be under 10MB' });
      return;
    }

    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'pdf') mimeType = 'application/pdf';
      else mimeType = 'application/pdf';
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      const attachmentObj = {
        original_filename: file.name,
        mime_type: mimeType,
        file_size: file.size,
        file_base64: base64Data,
      };

      if (isReply) {
        setReplyAttachments((prev) => [...prev, attachmentObj]);
      } else {
        setAttachments((prev) => [...prev, attachmentObj]);
      }
      setMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmittingTicket(true);
    setMessage(null);

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: newCategory,
          priority: newPriority,
          subject: newSubject.trim(),
          message: newMessage.trim(),
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        const ticketNum = json.data?.ticket_no || json.data?.ticket_number || json.data?.id;
        setMessage({ type: 'success', text: `Ticket #${ticketNum} created successfully.` });
        setNewSubject('');
        setNewMessage('');
        setAttachments([]);
        fetchTickets();
        fetchTicketDetail(json.data.id);
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to create ticket' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit ticket' });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const ticketId = ticketDetail?.ticket?.id;
    if (!token || !ticketId || !replyText.trim()) return;

    setSubmittingReply(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: replyText.trim(),
          attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setReplyText('');
        setReplyAttachments([]);
        fetchTicketDetail(ticketId);
        fetchTickets();
      } else {
        setMessage({ type: 'error', text: json.message || 'Could not post reply' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Reply failed' });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleCloseTicket = async () => {
    const ticketId = ticketDetail?.ticket?.id;
    if (!token || !ticketId) return;
    if (!window.confirm('Are you sure you want to mark this support ticket as closed?')) return;

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'closed' }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Ticket closed successfully.' });
        fetchTicketDetail(ticketId);
        fetchTickets();
      }
    } catch {
      // ignore
    }
  };

  const handlePreviewAttachment = async (storageKey: string, mimeType: string, filename: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/preview?key=${encodeURIComponent(storageKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewDoc({ url, mimeType, filename });
      } else {
        setMessage({ type: 'error', text: 'Failed to preview attachment' });
      }
    } catch {
      // ignore
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">Urgent</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase">High</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase">Medium</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold uppercase">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold uppercase">Open</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-mono font-bold uppercase">In Progress</span>;
      case 'waiting_for_client':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold uppercase">Awaiting Your Reply</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase">Resolved</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono font-bold uppercase">Closed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Broker Support Desk Contact Info Banner */}
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {branding.legal_entity_name || branding.broker_name || 'ForexCore'} Official Support
          </div>
          <div className="text-xs text-slate-300 mt-0.5">
            Our dedicated multilingual operations desk is standing by 24/5 to assist with your trading requirements.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <a
            href={`mailto:${branding.support_email || 'support@forexcore.com'}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a24] hover:bg-[#1c2433] text-blue-400 hover:text-blue-300 border border-[#232c3b] transition"
          >
            <Mail className="w-3.5 h-3.5 text-blue-400" />
            <span>{branding.support_email || 'support@forexcore.com'}</span>
          </a>
          <a
            href={`tel:${(branding.contact_phone || '+44 20 7946 0912').replace(/\s+/g, '')}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a24] hover:bg-[#1c2433] text-emerald-400 hover:text-emerald-300 border border-[#232c3b] transition"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>{branding.contact_phone || '+44 20 7946 0912'}</span>
          </a>
        </div>
      </div>

      {/* Header bar */}
      <div className="bg-[#121824] border border-[#26334d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>Support Ticket Desk</span>
          </h2>
          <p className="text-xs text-slate-400">
            Submit questions, report trading issues, or consult with compliance and billing teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== 'create' && (
            <button
              onClick={() => {
                setActiveTab('create');
                setMessage(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create New Ticket</span>
            </button>
          )}

          {activeTab !== 'list' && (
            <button
              onClick={() => {
                setActiveTab('list');
                setTicketDetail(null);
                fetchTickets();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] border border-[#26334d] text-slate-300 text-xs font-semibold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Tickets</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIEW 1: Ticket Creation Form */}
      {activeTab === 'create' && (
        <div className="bg-[#121824] border border-[#26334d] rounded-xl p-6 max-w-2xl mx-auto space-y-4 text-xs">
          <div className="border-b border-[#26334d] pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-400" />
              <span>Open a New Support Ticket</span>
            </h3>
            <button onClick={() => setActiveTab('list')} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Department / Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white"
                >
                  <option value="general">Account & General Inquiries</option>
                  <option value="deposit_withdrawal">Deposit & Withdrawal</option>
                  <option value="trading">Trading Execution & Spreads</option>
                  <option value="verification_kyc">KYC & Document Verification</option>
                  <option value="technical">Platform & Technical Support</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Priority Level *</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white"
                >
                  <option value="low">Low (General inquiry)</option>
                  <option value="medium">Medium (Standard request)</option>
                  <option value="high">High (Time sensitive)</option>
                  <option value="urgent">Urgent (Financial/Trading disruption)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Subject / Summary *</label>
              <input
                type="text"
                required
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Question regarding withdrawal processing time"
                className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Detailed Description *</label>
              <textarea
                rows={5}
                required
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Provide details, error messages, account numbers, or transaction IDs..."
                className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white placeholder-slate-500"
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="text-slate-400 block mb-1">Attachments (Optional, max 10MB each)</label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] border border-[#26334d] text-slate-300 flex items-center gap-1.5 transition">
                  <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                  <span>Add File</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, false)}
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                  />
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-[#182030] border border-[#26334d] flex items-center justify-between text-[11px]"
                    >
                      <span className="text-white truncate">{att.original_filename}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:text-rose-300 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 rounded-lg bg-[#182030] hover:bg-[#222c42] text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTicket}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"
              >
                {submittingTicket ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Submit Ticket</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2: Ticket List */}
      {activeTab === 'list' && (
        <div className="bg-[#121824] border border-[#26334d] rounded-xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-[#26334d] flex items-center justify-between bg-[#182030]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Your Support Tickets ({tickets.length})</span>
            </h3>

            <button
              onClick={fetchTickets}
              disabled={loading}
              className="text-slate-400 hover:text-white p-1"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-[#1e293b]">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                Loading support tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-600 mx-auto opacity-40" />
                <p>You have no active support tickets.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Your First Ticket</span>
                </button>
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => fetchTicketDetail(t.id)}
                  className="p-4 hover:bg-[#182030]/60 transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-blue-400 font-bold">#{t.ticket_number}</span>
                      <span className="font-bold text-white text-sm">{t.subject}</span>
                      {getPriorityBadge(t.priority)}
                      {getStatusBadge(t.status)}
                    </div>
                    <div className="text-slate-400 text-[11px] flex items-center gap-2">
                      <span className="capitalize">{t.category}</span>
                      <span>•</span>
                      <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Updated {new Date(t.last_reply_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchTicketDetail(t.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#182030] border border-[#26334d] text-slate-200 hover:text-white hover:border-blue-500 text-xs font-semibold flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>Open Conversation</span>
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: Ticket Detail & Conversation Thread */}
      {activeTab === 'detail' && ticketDetail && (
        <div className="space-y-4">
          {/* Thread Header Card */}
          <div className="bg-[#121824] border border-[#26334d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-blue-400 font-bold text-sm">
                  #{ticketDetail.ticket?.ticket_number || ticketDetail.ticket?.id || ''}
                </span>
                <h3 className="text-sm font-bold text-white">{ticketDetail.ticket?.subject || 'Support Ticket'}</h3>
                {getPriorityBadge(ticketDetail.ticket?.priority || 'medium')}
                {getStatusBadge(ticketDetail.ticket?.status || 'open')}
              </div>
              <div className="text-slate-400 text-[11px] flex items-center gap-2">
                <span className="capitalize">Department: {ticketDetail.ticket?.category || 'general'}</span>
                <span>•</span>
                <span>Opened {ticketDetail.ticket?.created_at ? new Date(ticketDetail.ticket.created_at).toLocaleString() : ''}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {ticketDetail.ticket?.status !== 'closed' && (
                <button
                  onClick={handleCloseTicket}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold"
                >
                  Close Ticket
                </button>
              )}
              <button
                onClick={() => ticketDetail.ticket?.id && fetchTicketDetail(ticketDetail.ticket.id)}
                disabled={loadingDetail}
                className="p-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] border border-[#26334d] text-slate-300"
                title="Refresh conversation"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDetail ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="space-y-3">
            {(ticketDetail.messages || []).map((msg) => {
              const isClient = msg.sender_role === 'client';
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border flex flex-col space-y-2 text-xs ${
                    isClient
                      ? 'bg-[#182030] border-[#26334d] ml-0 sm:ml-12'
                      : 'bg-[#15202b] border-blue-500/30 mr-0 sm:mr-12'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#26334d]/60 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          isClient ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {isClient ? <User className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-bold text-white">
                        {isClient ? 'You' : 'Support Desk Agent'}
                      </span>
                      {!isClient && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                          OFFICIAL AGENT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                    </span>
                  </div>

                  {/* Message Body */}
                  <div className="text-slate-200 leading-relaxed whitespace-pre-wrap py-1">
                    {msg.message}
                  </div>

                  {/* Attachments if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="pt-2 border-t border-[#26334d]/60 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => {
                        const storageKey = att.storage_key || (att as any).object_key;
                        return (
                          <button
                            key={att.id}
                            onClick={() => handlePreviewAttachment(storageKey, att.mime_type, att.original_filename)}
                            className="px-2.5 py-1 rounded bg-[#0b0e14] hover:bg-[#222c42] border border-[#26334d] text-blue-400 flex items-center gap-1.5 text-[11px] transition"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{att.original_filename}</span>
                            <span className="text-slate-500 text-[10px]">
                              ({(att.file_size ? att.file_size / 1024 : 0).toFixed(0)} KB)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reply Composer */}
          {ticketDetail.ticket?.status === 'closed' ? (
            <div className="p-4 rounded-xl bg-[#121824] border border-[#26334d] text-center text-slate-400 text-xs">
              This ticket has been marked as closed. If you have any further questions, please open a new support ticket.
            </div>
          ) : (
            <div className="bg-[#121824] border border-[#26334d] rounded-xl p-4 text-xs space-y-3">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                Post a Reply to Support
              </h4>

              <form onSubmit={handleReplyTicket} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg p-3 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] border border-[#26334d] text-slate-300 flex items-center gap-1.5 transition">
                    <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                    <span>Attach File</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, true)}
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submittingReply || !replyText.trim()}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center gap-2 transition"
                  >
                    {submittingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Reply</span>
                  </button>
                </div>

                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {replyAttachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-1 rounded bg-[#182030] border border-[#26334d] flex items-center gap-2 text-[10px]"
                      >
                        <span className="text-white truncate max-w-xs">{att.original_filename}</span>
                        <button
                          type="button"
                          onClick={() => setReplyAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#26334d] rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-[#26334d] flex items-center justify-between bg-[#182030]">
              <span className="text-xs font-bold text-white truncate max-w-md">
                {previewDoc.filename}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.filename}
                  className="p-1.5 rounded bg-[#0b0e14] hover:bg-[#222c42] text-slate-300 text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded hover:bg-[#222c42] text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-grow flex items-center justify-center bg-[#0b0e14]">
              {previewDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-[600px] rounded border border-slate-800"
                  title="PDF Attachment"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.filename}
                  className="max-h-[600px] max-w-full object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
