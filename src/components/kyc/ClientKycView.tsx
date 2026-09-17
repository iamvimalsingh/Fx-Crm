import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  UploadCloud,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  Info,
  ChevronRight,
  Download,
  X,
  FileImage,
} from 'lucide-react';

interface KycProfile {
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
  submitted_at: string | null;
  reviewed_at: string | null;
}

interface KycDocument {
  id: string;
  profile_id: string;
  user_id: string;
  document_type: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export function ClientKycView() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '1990-01-01',
    nationality: 'US',
    country_of_residence: 'US',
    address_line1: '',
    city: '',
    postal_code: '',
    id_document_type: 'passport',
    id_document_number: '',
    id_expiry_date: '2030-01-01',
  });

  // Upload state
  const [uploadDocType, setUploadDocType] = useState('passport');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; mimeType: string; filename: string } | null>(null);

  const fetchKycData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/kyc/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.status === 'success' && json.data) {
        if (json.data.profile) {
          setProfile(json.data.profile);
          setFormData({
            first_name: json.data.profile.first_name || '',
            last_name: json.data.profile.last_name || '',
            date_of_birth: json.data.profile.date_of_birth || '1990-01-01',
            nationality: json.data.profile.nationality || 'US',
            country_of_residence: json.data.profile.country_of_residence || 'US',
            address_line1: json.data.profile.address_line1 || '',
            city: json.data.profile.city || '',
            postal_code: json.data.profile.postal_code || '',
            id_document_type: json.data.profile.id_document_type || 'passport',
            id_document_number: json.data.profile.id_document_number || '',
            id_expiry_date: json.data.profile.id_expiry_date || '2030-01-01',
          });
        } else if (user) {
          setFormData((prev) => ({
            ...prev,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            country_of_residence: user.country || 'US',
          }));
        }
        setDocuments(json.data.documents || []);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load KYC information' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycData();
  }, [token]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingProfile(true);
    setMessage(null);

    try {
      const res = await fetch('/api/kyc/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setProfile(json.data);
        setMessage({
          type: 'success',
          text: 'Personal information saved successfully. Please ensure your verification documents are uploaded below.',
        });
      } else {
        setMessage({
          type: 'error',
          text: json.message || (json.errors ? json.errors.map((x: any) => x.message).join(', ') : 'Failed to submit profile'),
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred while submitting' });
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File exceeds maximum allowed size of 10MB' });
        return;
      }
      setSelectedFile(file);
      setMessage(null);
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedFile) return;

    setUploadingDoc(true);
    setMessage(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);
      const base64Data = await base64Promise;

      let mimeType = selectedFile.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'pdf') mimeType = 'application/pdf';
        else mimeType = 'application/pdf';
      }

      const payload = {
        document_type: uploadDocType,
        original_filename: selectedFile.name,
        mime_type: mimeType,
        file_size: selectedFile.size,
        file_base64: base64Data,
      };

      const res = await fetch('/api/kyc/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setMessage({ type: 'success', text: `Document "${selectedFile.name}" uploaded successfully for verification.` });
        setSelectedFile(null);
        fetchKycData();
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to upload document' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to remove this document?')) return;

    try {
      const res = await fetch(`/api/kyc/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setMessage({ type: 'success', text: 'Document removed successfully.' });
      } else {
        const json = await res.json();
        setMessage({ type: 'error', text: json.message || 'Could not delete document' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete' });
    }
  };

  const handlePreviewDocument = async (doc: KycDocument) => {
    if (!token) return;
    const key = doc.storage_key || (doc as any).object_key;
    if (!key) {
      setMessage({ type: 'error', text: 'Document storage key not available for preview.' });
      return;
    }
    try {
      const res = await fetch(`/api/documents/preview?key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewDoc({ url, mimeType: doc.mime_type, filename: doc.original_filename });
      } else {
        setMessage({ type: 'error', text: 'Failed to preview document.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Could not load preview' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const kycStatus = profile?.status || 'not_submitted';

  return (
    <div className="space-y-6">
      {/* KYC Status Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          kycStatus === 'approved'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : kycStatus === 'under_review' || kycStatus === 'pending'
            ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
            : kycStatus === 'rejected'
            ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-black/30 flex-shrink-0 mt-0.5">
            {kycStatus === 'approved' && <ShieldCheck className="w-6 h-6 text-emerald-400" />}
            {(kycStatus === 'pending' || kycStatus === 'under_review') && (
              <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
            )}
            {kycStatus === 'rejected' && <XCircle className="w-6 h-6 text-rose-400" />}
            {kycStatus === 'not_submitted' && <AlertTriangle className="w-6 h-6 text-blue-400" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                KYC Verification Status:
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                  kycStatus === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : kycStatus === 'under_review' || kycStatus === 'pending'
                    ? 'bg-amber-500/20 text-amber-400'
                    : kycStatus === 'rejected'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {kycStatus === 'not_submitted' ? 'Not Submitted' : kycStatus.replace('_', ' ')}
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {kycStatus === 'approved' &&
                'Your identity has been fully verified. All deposit, trading, and withdrawal limits are fully unlocked.'}
              {kycStatus === 'pending' &&
                'Your application has been received and is queued for compliance verification.'}
              {kycStatus === 'under_review' &&
                'Compliance officers are currently reviewing your documents. You will receive an immediate notification upon decision.'}
              {kycStatus === 'rejected' &&
                `Verification was rejected: "${profile?.rejection_reason || 'Incomplete documentation'}". You may update details and re-upload documents below.`}
              {kycStatus === 'not_submitted' &&
                'In compliance with international AML & regulatory requirements, please submit your legal identification details and documents.'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchKycData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222c42] border border-[#26334d] text-slate-300 text-xs font-semibold transition flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
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

      {/* Grid: Profile Form & Document Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Personal Information Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#121824] border border-[#26334d] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#26334d] pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Personal Identification Details
              </h3>
            </div>
            {kycStatus === 'approved' && (
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Locked & Verified
              </span>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">First Legal Name *</label>
                <input
                  type="text"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                  placeholder="e.g. Jane"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Last Legal Name *</label>
                <input
                  type="text"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                  placeholder="e.g. Doe"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nationality (ISO 2-letter) *</label>
                <input
                  type="text"
                  maxLength={2}
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value.toUpperCase() })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white uppercase font-mono disabled:opacity-60"
                  placeholder="US"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Residential Address *</label>
                <input
                  type="text"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                  placeholder="Street address, apartment or suite"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">City *</label>
                <input
                  type="text"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Postal / ZIP Code *</label>
                <input
                  type="text"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                  placeholder="10001"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">ID Document Type *</label>
                <select
                  disabled={kycStatus === 'approved'}
                  value={formData.id_document_type}
                  onChange={(e) => setFormData({ ...formData, id_document_type: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white disabled:opacity-60"
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID Card</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="other">Other Official Document</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">ID / Document Number *</label>
                <input
                  type="text"
                  required
                  disabled={kycStatus === 'approved'}
                  value={formData.id_document_number}
                  onChange={(e) => setFormData({ ...formData, id_document_number: e.target.value })}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60"
                  placeholder="e.g. A12345678"
                />
              </div>
            </div>

            {kycStatus !== 'approved' && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submittingProfile}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  {submittingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Personal Details</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Document Upload & List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Upload Form Box */}
          <div className="bg-[#121824] border border-[#26334d] rounded-xl p-5 space-y-4">
            <div className="border-b border-[#26334d] pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Upload Verification Document
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Max 10MB</span>
            </div>

            <form onSubmit={handleDocumentUpload} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Document Category</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full bg-[#182030] border border-[#26334d] rounded-lg px-3 py-2 text-white"
                >
                  <option value="passport">Passport (Bio Page)</option>
                  <option value="national_id">National ID Card (Front & Back)</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="proof_of_address">Proof of Address (Utility/Bank Statement)</option>
                  <option value="other">Other Legal Document</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Choose File (PDF, PNG, JPG)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer bg-[#182030] border border-[#26334d] rounded-lg p-1.5"
                />
                {selectedFile && (
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedFile || uploadingDoc}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {uploadingDoc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>Upload Document</span>
              </button>
            </form>
          </div>

          {/* Uploaded Documents List */}
          <div className="bg-[#121824] border border-[#26334d] rounded-xl p-4 space-y-3">
            <div className="border-b border-[#26334d] pb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-blue-400" />
                <span>Uploaded Documents ({documents.length})</span>
              </h4>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No documents uploaded yet. Upload a proof of identity or address above.
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-lg bg-[#182030] border border-[#26334d] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5 font-semibold text-white truncate">
                        <span className="truncate">{doc.original_filename}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold ${
                            doc.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : doc.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {doc.document_type.replace('_', ' ')} • {formatFileSize(doc.file_size)}
                      </div>
                      {doc.rejection_reason && (
                        <p className="text-[10px] text-rose-400 mt-1">Reason: {doc.rejection_reason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handlePreviewDocument(doc)}
                        className="p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                        title="View Document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {doc.status !== 'approved' && (
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121824] border border-[#26334d] rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#26334d] flex items-center justify-between bg-[#182030]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white truncate max-w-md">
                  {previewDoc.filename}
                </span>
              </div>
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
                  title="PDF Preview"
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
