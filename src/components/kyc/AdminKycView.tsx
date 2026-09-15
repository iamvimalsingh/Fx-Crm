import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Download,
  X,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

interface KycProfileAdminItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  country_of_residence: string;
  address_line1: string;
  city: string;
  postal_code: string;
  id_document_type: string;
  id_document_number: string;
  id_expiry_date: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    country: string;
  };
  document_count?: number;
}

interface KycDetailResponse {
  profile: KycProfileAdminItem;
  documents: Array<{
    id: string;
    document_type: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    storage_key: string;
    status: string;
    created_at: string;
  }>;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    country: string;
  };
}

export function AdminKycView() {
  const { token, user: adminUser } = useAuth();
  const [profiles, setProfiles] = useState<KycProfileAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<KycDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | 'under_review'>('approved');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Document preview modal inside admin
  const [previewDoc, setPreviewDoc] = useState<{ url: string; mimeType: string; filename: string } | null>(null);

  // Quick row actions
  const [quickRejectTarget, setQuickRejectTarget] = useState<KycProfileAdminItem | null>(null);
  const [quickRejectReason, setQuickRejectReason] = useState('');
  const [submittingQuickAction, setSubmittingQuickAction] = useState(false);

  const fetchProfiles = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = statusFilter === 'all'
        ? `/api/admin/kyc?limit=50`
        : `/api/admin/kyc?status=${statusFilter}&limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.status === 'success' && json.data) {
        setProfiles(json.data.profiles || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDirectApprove = async (profileId: string) => {
    if (!token) return;
    setSubmittingQuickAction(true);
    try {
      const res = await fetch(`/api/admin/kyc/${profileId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'approved',
          admin_notes: 'One-click compliance approval from queue',
        }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMessage({ type: 'success', text: 'Application approved successfully.' });
        fetchProfiles();
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to approve application' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error executing approval' });
    } finally {
      setSubmittingQuickAction(false);
    }
  };

  const handleConfirmQuickReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !quickRejectTarget || !quickRejectReason.trim()) return;
    setSubmittingQuickAction(true);
    try {
      const res = await fetch(`/api/admin/kyc/${quickRejectTarget.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: quickRejectReason.trim(),
          admin_notes: 'Compliance rejection from queue',
        }),
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMessage({ type: 'success', text: 'Application marked as rejected.' });
        setQuickRejectTarget(null);
        setQuickRejectReason('');
        fetchProfiles();
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to reject application' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error executing rejection' });
    } finally {
      setSubmittingQuickAction(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [token, statusFilter]);

  const handleOpenDetail = async (id: string) => {
    setSelectedProfileId(id);
    setLoadingDetail(true);
    setDetailData(null);
    setMessage(null);
    setRejectionReason('');
    setAdminNotes('');

    try {
      const res = await fetch(`/api/admin/kyc/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.status === 'success' && json.data) {
        setDetailData(json.data);
        setReviewAction(json.data.profile.status === 'pending' ? 'approved' : json.data.profile.status);
        if (json.data.profile.admin_notes) setAdminNotes(json.data.profile.admin_notes);
        if (json.data.profile.rejection_reason) setRejectionReason(json.data.profile.rejection_reason);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch application details' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedProfileId) return;

    if (reviewAction === 'rejected' && !rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Rejection reason is required when rejecting an application.' });
      return;
    }

    setSubmittingReview(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/kyc/${selectedProfileId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: reviewAction,
          rejection_reason: reviewAction === 'rejected' ? rejectionReason.trim() : undefined,
          admin_notes: adminNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMessage({ type: 'success', text: `Application successfully updated to ${reviewAction.toUpperCase()}` });
        fetchProfiles();
        // Refresh detail view
        handleOpenDetail(selectedProfileId);
      } else {
        setMessage({ type: 'error', text: json.message || 'Review failed' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error executing review' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handlePreviewDocument = async (storageKey: string, mimeType: string, filename: string) => {
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
        setMessage({ type: 'error', text: 'Unable to preview document' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading preview' });
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(term);
    const emailMatch = p.user?.email.toLowerCase().includes(term);
    const idMatch = p.id_document_number?.toLowerCase().includes(term);
    return nameMatch || emailMatch || idMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>KYC Compliance & Verification Desk</span>
          </h2>
          <p className="text-xs text-slate-400">
            Review identity documents, verify client profiles, and approve/reject applications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProfiles}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-slate-200 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
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

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] p-1 rounded-lg overflow-x-auto text-xs">
          {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded capitalize font-medium transition ${
                statusFilter === st
                  ? 'bg-[#1f6feb] text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client or document #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#161b22] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#21262d] text-slate-400 border-b border-[#30363d] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Applicant</th>
                <th className="py-3 px-4 font-semibold">Nationality / Country</th>
                <th className="py-3 px-4 font-semibold">Document Type & #</th>
                <th className="py-3 px-4 font-semibold">Submitted</th>
                <th className="py-3 px-4 font-semibold">Files</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading KYC applications...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No applications found in this queue.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-[#21262d]/50 transition">
                    <td className="py-3 px-4 font-medium text-white">
                      <div>
                        <span className="font-bold">{p.first_name} {p.last_name}</span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.user?.email || p.user_id}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span>{p.country_of_residence}</span>
                      <span className="text-[10px] text-slate-400 ml-1 font-mono">({p.nationality})</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize">{p.id_document_type.replace('_', ' ')}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{p.id_document_number}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[11px]">
                        {p.document_count || 0} doc(s)
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          p.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : p.status === 'under_review' || p.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status !== 'approved' && (
                          <button
                            onClick={() => handleDirectApprove(p.id)}
                            disabled={submittingQuickAction}
                            className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1 transition"
                            title="One-click Approve"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Approve</span>
                          </button>
                        )}
                        {p.status !== 'rejected' && (
                          <button
                            onClick={() => {
                              setQuickRejectTarget(p);
                              setQuickRejectReason('');
                            }}
                            disabled={submittingQuickAction}
                            className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold inline-flex items-center gap-1 transition"
                            title="Reject with reason"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Reject</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetail(p.id)}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal / Drawer */}
      {selectedProfileId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#21262d]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  KYC Verification Review & Compliance Audit
                </h3>
              </div>
              <button
                onClick={() => setSelectedProfileId(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow text-xs">
              {loadingDetail || !detailData ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                  Loading application profile & documents...
                </div>
              ) : (
                <>
                  {/* Applicant Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Full Legal Name:</span>
                      <span className="text-white font-bold text-sm">
                        {detailData.profile.first_name} {detailData.profile.last_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email Account:</span>
                      <span className="text-blue-400 font-mono">
                        {detailData.user?.email || detailData.profile.user_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Current Status:</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          detailData.profile.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : detailData.profile.status === 'under_review' || detailData.profile.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {detailData.profile.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Date of Birth:</span>
                      <span className="text-slate-200">{detailData.profile.date_of_birth}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Nationality / Residence:</span>
                      <span className="text-slate-200">
                        {detailData.profile.nationality} / {detailData.profile.country_of_residence}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Residential Address:</span>
                      <span className="text-slate-200">
                        {detailData.profile.address_line1}, {detailData.profile.city} {detailData.profile.postal_code}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Document Type:</span>
                      <span className="text-slate-200 capitalize">
                        {detailData.profile.id_document_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Document Number:</span>
                      <span className="text-slate-200 font-mono">{detailData.profile.id_document_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Expiration Date:</span>
                      <span className="text-slate-200 font-mono">
                        {detailData.profile.id_expiry_date || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Documents Section */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Submitted Documents ({detailData.documents.length})</span>
                    </h4>

                    {detailData.documents.length === 0 ? (
                      <div className="p-4 rounded-lg bg-[#0d1117] border border-[#30363d] text-center text-slate-500">
                        No files uploaded by client yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {detailData.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-between gap-2"
                          >
                            <div className="overflow-hidden">
                              <span className="font-bold text-white truncate block">
                                {doc.original_filename}
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {doc.document_type.replace('_', ' ')} • {(doc.file_size / 1024).toFixed(1)} KB
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                handlePreviewDocument(doc.storage_key, doc.mime_type, doc.original_filename)
                              }
                              className="px-2.5 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 flex items-center gap-1 text-xs font-semibold flex-shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View File</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Decision Form */}
                  <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2 border-t border-[#30363d]">
                    <h4 className="font-bold text-white uppercase tracking-wider text-xs">
                      Compliance Officer Decision
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewAction('approved')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${
                          reviewAction === 'approved'
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/50'
                            : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>APPROVE KYC</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewAction('under_review')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${
                          reviewAction === 'under_review'
                            ? 'bg-amber-950/60 border-amber-500 text-amber-300 ring-2 ring-amber-500/50'
                            : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Clock className="w-5 h-5 text-amber-400" />
                        <span>MARK UNDER REVIEW</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewAction('rejected')}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${
                          reviewAction === 'rejected'
                            ? 'bg-rose-950/60 border-rose-500 text-rose-300 ring-2 ring-rose-500/50'
                            : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <span>REJECT APPLICATION</span>
                      </button>
                    </div>

                    {reviewAction === 'rejected' && (
                      <div>
                        <label className="text-rose-400 block mb-1 font-semibold">
                          Rejection Justification Reason (Sent to Client) *
                        </label>
                        <input
                          type="text"
                          required
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. Document image is blurry or expired passport"
                          className="w-full bg-[#0d1117] border border-rose-500/50 rounded-lg px-3 py-2 text-white placeholder-slate-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-slate-400 block mb-1">
                        Internal Compliance Audit Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Internal compliance notes for regulatory records..."
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white placeholder-slate-500"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProfileId(null)}
                        className="px-4 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"
                      >
                        {submittingReview && <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>Submit Decision</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Full View Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
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
                  className="w-full h-[650px] rounded border border-slate-800"
                  title="PDF Document"
                />
              ) : (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.filename}
                  className="max-h-[650px] max-w-full object-contain rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Quick Reject Modal */}
      {quickRejectTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-white text-sm">Reject KYC Application</h3>
              </div>
              <button
                onClick={() => setQuickRejectTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Rejecting application for <strong className="text-white">{quickRejectTarget.first_name} {quickRejectTarget.last_name}</strong>. A reason is required to notify the applicant.
            </p>

            <form onSubmit={handleConfirmQuickReject} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Rejection Reason (Required) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={quickRejectReason}
                  onChange={(e) => setQuickRejectReason(e.target.value)}
                  placeholder="e.g., Passport photo blurred, expired document, address mismatch..."
                  className="w-full bg-[#0d1117] border border-rose-500/40 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickRejectTarget(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuickAction || !quickRejectReason.trim()}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingQuickAction ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
