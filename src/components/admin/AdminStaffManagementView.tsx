import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  UserCheck,
  UserX,
  UserPlus,
  Shield,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  Calendar,
  KeyRound,
  X,
  Clock,
} from 'lucide-react';

interface StaffAdmin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin';
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export function AdminStaffManagementView() {
  const { token, user } = useAuth();
  const [admins, setAdmins] = useState<StaffAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Admin Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Deactivation confirmation state
  const [deactivatingAdmin, setDeactivatingAdmin] = useState<StaffAdmin | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const fetchAdmins = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/staff', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setAdmins(json.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [token]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          first_name: newFirstName,
          last_name: newLastName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to provision staff administrator');
      }

      setFeedback({
        type: 'success',
        text: `Staff administrator ${newEmail} successfully provisioned and recorded in immutable security audit log.`,
      });
      setShowAddModal(false);
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setNewPassword('');
      fetchAdmins();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Error provisioning staff administrator',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (targetAdmin: StaffAdmin, newStatus: 'active' | 'suspended', reason?: string) => {
    if (!token) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/staff/status', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: targetAdmin.id,
          status: newStatus,
          reason: reason || 'Administrative governance decision',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to update administrator status');
      }

      setFeedback({
        type: 'success',
        text: `Administrator ${targetAdmin.email} has been ${newStatus === 'suspended' ? 'deactivated' : 'activated'}. Recorded with audit trail.`,
      });
      setDeactivatingAdmin(null);
      setDeactivateReason('');
      fetchAdmins();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Status change failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const activeAdminsCount = admins.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="bg-[#0b0e14] border border-[#1b222d] p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Staff Administrator Directory & Governance
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
              Strict 2-Tier: Admin
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Provision, review, and govern authorized Back Office staff. All accounts share identical administrative privileges with immutable action attribution.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAdmins}
            className="p-2 rounded-lg bg-[#141a24] hover:bg-[#1b2330] text-slate-300 hover:text-white border border-[#232c3b] transition"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition shadow-lg shadow-purple-600/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Provision Staff Admin</span>
          </button>
        </div>
      </div>

      {/* Feedback alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Governance Metrics Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500">Total Staff Accounts</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{admins.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Authorized Back Office personnel</div>
        </div>
        <div className="bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500">Active Administrators</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{activeAdminsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Operational sign-in permitted</div>
        </div>
        <div className="bg-[#0b0e14] border border-[#1b222d] p-4 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500">Role Model Standard</div>
          <div className="text-sm font-bold text-purple-400 mt-2 flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Strict 2-Tier Architecture
          </div>
          <div className="text-[11px] text-slate-400 mt-1">No multi-tenant or tier overrides</div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-[#0b0e14] border border-[#1b222d] rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1b222d] flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Operational Staff Directory ({admins.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Immutable Audit Trail Enforced
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span>Loading staff administrators...</span>
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No administrators found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#07090e] border-b border-[#1b222d] text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="p-3.5">Administrator</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Provisioned</th>
                  <th className="p-3.5">Last Login</th>
                  <th className="p-3.5 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b222d]/60">
                {admins.map((adm) => {
                  const isCurrentSessionUser = String(user?.id) === String(adm.id) || user?.email === adm.email;
                  const isSoleActive = adm.status === 'active' && activeAdminsCount <= 1;

                  return (
                    <tr key={adm.id} className="hover:bg-[#121722]/50 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {adm.first_name ? adm.first_name[0].toUpperCase() : 'A'}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{adm.first_name} {adm.last_name}</span>
                              {isCurrentSessionUser && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {adm.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          admin
                        </span>
                      </td>
                      <td className="p-3.5">
                        {adm.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Suspended
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(adm.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {adm.last_login_at ? new Date(adm.last_login_at).toLocaleString() : 'Never logged in'}
                      </td>
                      <td className="p-3.5 text-right">
                        {adm.status === 'active' ? (
                          <button
                            onClick={() => setDeactivatingAdmin(adm)}
                            disabled={isCurrentSessionUser || isSoleActive || actionLoading}
                            title={
                              isCurrentSessionUser
                                ? 'Cannot deactivate your own account'
                                : isSoleActive
                                ? 'Cannot deactivate the sole remaining active administrator'
                                : 'Deactivate this administrator'
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 font-semibold text-xs transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Deactivate</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(adm, 'active', 'Re-activated by administrator')}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-semibold text-xs transition disabled:opacity-30"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Activate</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision New Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#1b222d] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1b222d] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">Provision Staff Administrator</h3>
                  <p className="text-[11px] text-slate-400">Creates a new Back Office administrator account</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Staff"
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Member"
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Staff Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@brokerage.com"
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white font-mono outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Temporary Secure Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg pl-9 pr-3 py-2 text-white outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-purple-300">Audited Operation:</span> Provisioning this account will be recorded in the security audit trail attributed to your administrator identity.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#1b222d]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#141a24] hover:bg-[#1b2330] text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50 shadow-lg shadow-purple-600/20"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Provision Administrator</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingAdmin && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0b0e14] border border-[#1b222d] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Confirm Administrator Deactivation</h3>
                <p className="text-[11px] text-slate-400">Suspends Back Office privileges immediately</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-[#07090e] border border-[#1b222d] p-3.5 rounded-xl space-y-1 font-mono">
              <div>Account: <span className="text-white font-bold">{deactivatingAdmin.first_name} {deactivatingAdmin.last_name}</span></div>
              <div>Email: <span className="text-rose-300">{deactivatingAdmin.email}</span></div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Deactivation Reason (Recorded in Audit Ledger)
              </label>
              <textarea
                rows={2}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="e.g. Staff role transition, governance rotation..."
                className="w-full bg-[#07090e] border border-[#1b222d] rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1b222d]">
              <button
                type="button"
                onClick={() => setDeactivatingAdmin(null)}
                className="px-4 py-2 rounded-lg bg-[#141a24] hover:bg-[#1b2330] text-slate-300 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleToggleStatus(deactivatingAdmin, 'suspended', deactivateReason)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition disabled:opacity-50 shadow-lg shadow-rose-600/20"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                <span>Confirm Deactivation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
