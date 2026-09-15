import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  HelpCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Send,
  X,
  FileText,
  Download,
  RefreshCw,
  Search,
  Eye,
  Shield,
  User,
  Lock,
  MessageCircle,
  Sliders,
} from 'lucide-react';

interface AdminTicketItem {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_client' | 'resolved' | 'closed';
  assigned_to: string | null;
  last_reply_at: string;
  created_at: string;
  updated_at: string;
  client?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface AdminMessageItem {
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

interface AdminTicketDetail {
  ticket: AdminTicketItem;
  messages: AdminMessageItem[];
}

export function AdminSupportView() {
  const { token, user: adminUser } = useAuth();
  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<AdminTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reply form state
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<
    Array<{ original_filename: string; mime_type: string; file_size: number; file_base64: string }>
  >([]);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Document preview
  const [previewDoc, setPreviewDoc] = useState<{ url: string; mimeType: string; filename: string } | null>(null);

  const fetchTickets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = statusFilter === 'all'
        ? `/api/admin/support/tickets?limit=100`
        : `/api/admin/support/tickets?status=${statusFilter}&limit=100`;
      const res = await fetch(url, {
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
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.status === 'success' && json.data) {
        setTicketDetail(json.data);
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to load ticket details' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading ticket details' });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [token, statusFilter]);

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setMessage(null);
    fetchTicketDetail(ticketId);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !selectedTicketId) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicketId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMessage({ type: 'success', text: `Status updated to ${newStatus.toUpperCase()}` });
        fetchTicketDetail(selectedTicketId);
        fetchTickets();
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to update status' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Update error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Attachment must be under 10MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      setReplyAttachments((prev) => [
        ...prev,
        {
          original_filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size,
          file_base64: base64Data,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTicketId || !replyText.trim()) return;

    setSubmittingReply(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: replyText.trim(),
          is_internal: isInternalNote,
          attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setReplyText('');
        setReplyAttachments([]);
        setIsInternalNote(false);
        fetchTicketDetail(selectedTicketId);
        fetchTickets();
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to post reply' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error posting reply' });
    } finally {
      setSubmittingReply(false);
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
      }
    } catch {
      // ignore
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const numMatch = t.ticket_number?.toLowerCase().includes(term);
    const subMatch = t.subject?.toLowerCase().includes(term);
    const clientMatch = t.client?.email?.toLowerCase().includes(term);
    return numMatch || subMatch || clientMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Support Desk Administration & Ticketing Queue</span>
          </h2>
          <p className="text-xs text-slate-400">
            Handle customer inquiries, post internal compliance notes, and resolve operational issues.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Tickets</span>
        </button>
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

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] p-1 rounded-lg overflow-x-auto text-xs">
          {(['all', 'open', 'in_progress', 'waiting_for_client', 'resolved', 'closed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded capitalize font-medium transition ${
                statusFilter === st
                  ? 'bg-[#1f6feb] text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search #, subject, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#21262d] text-slate-400 border-b border-[#30363d] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Ticket #</th>
                <th className="py-3 px-4 font-semibold">Client</th>
                <th className="py-3 px-4 font-semibold">Subject & Department</th>
                <th className="py-3 px-4 font-semibold">Priority</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Updated</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No support tickets found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-[#21262d]/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      #{t.ticket_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {t.client ? `${t.client.first_name} ${t.client.last_name}` : 'Client'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{t.client?.email || t.user_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 truncate max-w-xs">{t.subject}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{t.category}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-400'
                            : t.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-400'
                            : t.priority === 'medium'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          t.status === 'open'
                            ? 'bg-blue-500/20 text-blue-400'
                            : t.status === 'in_progress'
                            ? 'bg-purple-500/20 text-purple-400'
                            : t.status === 'waiting_for_client'
                            ? 'bg-amber-500/20 text-amber-400'
                            : t.status === 'resolved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(t.last_reply_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenTicket(t.id)}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Management Modal */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Ticket #{ticketDetail?.ticket.ticket_number}</span>
                    <span className="text-slate-400 font-normal">|</span>
                    <span>{ticketDetail?.ticket.subject}</span>
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicketId(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Frame */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow text-xs">
              {loadingDetail || !ticketDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                  Loading conversation stream...
                </div>
              ) : (
                <>
                  {/* Ticket Metadata & Quick Status Bar */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Client:</span>
                        <span className="text-white font-semibold">
                          {ticketDetail.ticket.client
                            ? `${ticketDetail.ticket.client.first_name} ${ticketDetail.ticket.client.last_name}`
                            : 'Client'}
                        </span>
                        <span className="font-mono text-blue-400">({ticketDetail.ticket.client?.email})</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Category: <strong className="text-white uppercase">{ticketDetail.ticket.category}</strong></span>
                        <span>•</span>
                        <span>Priority: <strong className="text-white uppercase">{ticketDetail.ticket.priority}</strong></span>
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 text-xs font-semibold">Update Status:</label>
                      <select
                        disabled={updatingStatus}
                        value={ticketDetail.ticket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting_for_client">Waiting For Client</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  {/* Messages Timeline */}
                  <div className="space-y-3">
                    {ticketDetail.messages.map((msg) => {
                      const isClient = msg.sender_role === 'client';
                      const isInternal = msg.is_internal;

                      return (
                        <div
                          key={msg.id}
                          className={`p-4 rounded-xl border flex flex-col space-y-2 text-xs ${
                            isInternal
                              ? 'bg-amber-950/40 border-amber-500/50'
                              : isClient
                              ? 'bg-[#0d1117] border-[#30363d]'
                              : 'bg-[#1c2433] border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-[#30363d]/60 pb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  isInternal
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : isClient
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {isInternal ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                ) : isClient ? (
                                  <User className="w-3.5 h-3.5" />
                                ) : (
                                  <Shield className="w-3.5 h-3.5" />
                                )}
                              </div>

                              <span className="font-bold text-white">
                                {isClient
                                  ? `${msg.sender?.first_name || 'Client'} (Applicant)`
                                  : `${msg.sender?.first_name || 'Support Officer'}`}
                              </span>

                              {isInternal && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono">
                                  INTERNAL STAFF NOTE (Hidden from Client)
                                </span>
                              )}
                              {!isClient && !isInternal && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                                  SUPPORT RESPONSE
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-slate-200 leading-relaxed whitespace-pre-wrap py-1">
                            {msg.message}
                          </div>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="pt-2 border-t border-[#30363d]/60 flex flex-wrap gap-2">
                              {msg.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  onClick={() =>
                                    handlePreviewAttachment(att.storage_key, att.mime_type, att.original_filename)
                                  }
                                  className="px-2.5 py-1 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-blue-400 flex items-center gap-1.5 text-[11px] transition"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>{att.original_filename}</span>
                                  <span className="text-slate-500 text-[10px]">
                                    ({(att.file_size / 1024).toFixed(0)} KB)
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Admin Reply & Internal Note Composer */}
                  <form onSubmit={handleAdminReply} className="space-y-3 pt-2 border-t border-[#30363d]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsInternalNote(false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            !isInternalNote
                              ? 'bg-blue-600 text-white shadow'
                              : 'bg-[#0d1117] border border-[#30363d] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Reply to Client</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsInternalNote(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            isInternalNote
                              ? 'bg-amber-600 text-white shadow'
                              : 'bg-[#0d1117] border border-[#30363d] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Add Internal Staff Note</span>
                        </button>
                      </div>

                      {isInternalNote && (
                        <span className="text-[10px] text-amber-400 font-mono font-semibold">
                          Client will NOT see this note
                        </span>
                      )}
                    </div>

                    <textarea
                      rows={3}
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? 'Write internal compliance or handover note...'
                          : 'Write response to client...'
                      }
                      className={`w-full rounded-lg p-3 text-white placeholder-slate-500 text-xs focus:outline-none ${
                        isInternalNote
                          ? 'bg-amber-950/20 border border-amber-500/40 focus:border-amber-500'
                          : 'bg-[#0d1117] border border-[#30363d] focus:border-blue-500'
                      }`}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-slate-300 flex items-center gap-1.5 transition">
                        <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                        <span>Add File Attachment</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          accept="image/*,application/pdf,text/plain"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={submittingReply || !replyText.trim()}
                        className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition text-white ${
                          isInternalNote
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {submittingReply ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isInternalNote ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{isInternalNote ? 'Save Internal Note' : 'Send Reply to Client'}</span>
                      </button>
                    </div>

                    {replyAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {replyAttachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-1 rounded bg-[#0d1117] border border-[#30363d] flex items-center gap-2 text-[10px]"
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]">
              <span className="text-xs font-bold text-white truncate max-w-md">
                {previewDoc.filename}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.filename}
                  className="p-1.5 rounded bg-[#0d1117] hover:bg-[#30363d] text-slate-300 text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded hover:bg-[#30363d] text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-grow flex items-center justify-center bg-[#0d1117]">
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
