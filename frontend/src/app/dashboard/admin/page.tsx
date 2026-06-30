"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  UserSquare2, 
  ArrowLeft, 
  Cpu, 
  ShieldCheck, 
  Users, 
  Activity, 
  UserPlus,
  Edit2,
  Trash2,
  Key,
  Power,
  PowerOff,
  ClipboardList,
  CheckCircle,
  XCircle,
  X,
  Lock
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { apiFetch } from "@/lib/api";

interface UserRecord {
  id: number;
  username: string;
  name?: string;
  email: string;
  role: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  last_login?: string;
}

interface AuditRecord {
  id: number;
  timestamp: string;
  username: string;
  event: string;
  status: string;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  
  // Selected user for edit/reset
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Form states - Create User
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Underwriter");
  const [password, setPassword] = useState("");
  
  // Form states - Edit User
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  
  // Form states - Password Reset
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, telemetryRes, auditsRes] = await Promise.all([
        apiFetch("/api/auth/users"),
        apiFetch("/api/analytics/summary"),
        apiFetch("/api/audits/?limit=50")
      ]);
      
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const telemetryData = telemetryRes.ok ? await telemetryRes.json() : null;
      const auditsData = auditsRes.ok ? await auditsRes.json() : [];
      
      setUsersList(usersData);
      setTelemetry(telemetryData);
      setAuditLogs(auditsData);
    } catch (err) {
      console.warn("FastAPI offline or API error. Seeding default data.");
      setUsersList([
        { id: 1, username: "admin_canara", name: "Canara Admin", email: "admin.security@canarabank.in", role: "Admin", is_active: true, created_at: "2026-06-30T10:00:00Z" },
        { id: 2, username: "sharan_underwriter", name: "Sharan K", email: "sharan.k@canarabank.in", role: "Underwriter", is_active: true, created_at: "2026-06-30T11:00:00Z", last_login: "2026-06-30T14:00:00Z" },
        { id: 3, username: "auditor_compliance", name: "Auditor Compliance", email: "auditor.compliance@canarabank.in", role: "Auditor", is_active: true, created_at: "2026-06-30T12:00:00Z" }
      ]);
      setTelemetry({
        system_health: { cpu_usage: 24.5, memory_usage: 48.2, redis_status: "Healthy", celery_workers: 4, model_accuracy: 98.4 }
      });
      setAuditLogs([
        { id: 1, timestamp: "2026-06-30T14:00:00Z", username: "admin_canara", event: "Admin dashboard loaded", status: "Success" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    try {
      const response = await apiFetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, email, role, password })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create user.");
      }
      setIsCreateOpen(false);
      // Reset form fields
      setUsername("");
      setName("");
      setEmail("");
      setRole("Underwriter");
      setPassword("");
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    setErrorMsg("");
    try {
      const response = await apiFetch(`/api/auth/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to update user.");
      }
      setIsEditOpen(false);
      setSelectedUser(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    setErrorMsg("");
    try {
      const response = await apiFetch(`/api/auth/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordVal })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to reset password.");
      }
      setIsResetOpen(false);
      setResetPasswordVal("");
      setSelectedUser(null);
      alert(`Password reset successfully for ${selectedUser.username}`);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (userRecord: UserRecord) => {
    try {
      const response = await apiFetch(`/api/auth/users/${userRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !userRecord.is_active })
      });
      if (!response.ok) throw new Error();
      await fetchData();
    } catch (err) {
      alert("Failed to toggle account activation status.");
    }
  };

  const handleDeleteUser = async (userId: number, usernameVal: string) => {
    if (!confirm(`Are you sure you want to permanently delete corporate keycard permissions for user "${usernameVal}"? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await apiFetch(`/api/auth/users/${userId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete user.");
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (userRecord: UserRecord) => {
    setSelectedUser(userRecord);
    setEditName(userRecord.name || "");
    setEditEmail(userRecord.email);
    setEditRole(userRecord.role);
    setErrorMsg("");
    setIsEditOpen(true);
  };

  const openResetModal = (userRecord: UserRecord) => {
    setSelectedUser(userRecord);
    setResetPasswordVal("");
    setErrorMsg("");
    setIsResetOpen(true);
  };

  // Guard - Block access if user is not Admin
  if (user?.role !== "Admin") {
    return (
      <div className="border border-red-500/20 rounded-2xl bg-red-950/5 p-8 text-center max-w-xl mx-auto mt-12">
        <UserSquare2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h4 className="text-base font-bold text-white">Admin Clearance Keycard Required</h4>
        <p className="text-xs text-slate-500 mt-2">
          Your credentials ({user?.role}) do not have permission to view hardware diagnostics or manage bank officer logins.
        </p>
        <Link href="/dashboard" className="text-xs text-accent hover:underline mt-6 inline-block">Return to dashboard</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-t-2 border-accent border-solid rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500">Retrieving operational bank records...</p>
      </div>
    );
  }

  const health = telemetry?.system_health || { cpu_usage: 24.5, memory_usage: 48.2, redis_status: "Healthy", celery_workers: 4, model_accuracy: 98.4 };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex items-center space-x-3">
        <Link 
          href="/dashboard"
          className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white font-sans">Admin Settings & Monitoring</h2>
          <p className="text-xs text-slate-500">Configure bank officer security clearances and analyze machine learning hardware diagnostics</p>
        </div>
      </div>

      {/* SYSTEM HARDWARE DIAGNOSTICS & TELEMETRY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Model Accuracy */}
        <div className="p-5 border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur-md relative">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Model Accuracy Rating</p>
          <h3 className="text-2xl font-extrabold text-emerald-400 font-mono">{health.model_accuracy}%</h3>
          <span className="absolute top-4 right-4 text-slate-700"><ShieldCheck className="w-5 h-5 text-emerald-400" /></span>
        </div>

        {/* CPU Util */}
        <div className="p-5 border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur-md relative">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">PyTorch GPU CPU Load</p>
          <h3 className="text-2xl font-extrabold text-white font-mono">{health.cpu_usage}%</h3>
          <span className="absolute top-4 right-4 text-slate-700"><Cpu className="w-5 h-5 text-accent" /></span>
        </div>

        {/* Memory Load */}
        <div className="p-5 border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur-md relative">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ram Memory Buffer</p>
          <h3 className="text-2xl font-extrabold text-white font-mono">{health.memory_usage}%</h3>
          <span className="absolute top-4 right-4 text-slate-700"><Activity className="w-5 h-5 text-accent animate-pulse" /></span>
        </div>

        {/* Redis health */}
        <div className="p-5 border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur-md relative">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Celery Queue Status</p>
          <h3 className="text-2xl font-extrabold text-white font-mono">{health.redis_status}</h3>
          <span className="absolute top-4 right-4 text-slate-500 text-xs font-mono">({health.celery_workers} workers)</span>
        </div>
      </div>

      {/* OFFICERS ROLES MANAGEMENT */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6 glass-panel relative overflow-hidden">
        <div className="h-1 bg-accent absolute top-0 left-0 w-full" />
        
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-accent" />
              <span>Officer Credentials Ledger</span>
            </h4>
            <p className="text-[10px] text-slate-500">Manage user logins and assign underwrite security credentials</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-accent text-slate-950 text-xs font-bold rounded-lg hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 flex items-center space-x-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create New Officer</span>
            </button>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 border border-slate-800 rounded-lg">
              Total Officers: {usersList.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th className="pb-3 pl-2">Name</th>
                <th className="pb-3">Username</th>
                <th className="pb-3">Corporate Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Last Active Session</th>
                <th className="pb-3 text-right pr-2">Clearance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {usersList.map((usr) => (
                <tr key={usr.id} className="hover:bg-slate-800/10 transition-colors">
                  <td className="py-4 font-bold text-slate-200 pl-2">
                    {usr.name || "—"}
                  </td>
                  <td className="py-4 text-slate-300 font-mono text-[11px]">
                    {usr.username}
                  </td>
                  <td className="py-4 text-slate-400 font-mono text-[11px]">
                    {usr.email}
                  </td>
                  <td className="py-4">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold font-mono text-[9px] uppercase border ${
                      usr.role === "Admin" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                      usr.role === "Auditor" ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
                      "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      {usr.role}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                      usr.is_active 
                        ? "bg-green-500/10 border-green-500/30 text-green-400" 
                        : "bg-slate-500/10 border-slate-500/30 text-slate-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${usr.is_active ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
                      <span>{usr.is_active ? "Active" : "Deactivated"}</span>
                    </span>
                  </td>
                  <td className="py-4 text-slate-400 font-mono text-[10px]">
                    {usr.last_login ? new Date(usr.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="py-4 text-right pr-2">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(usr)}
                        title="Edit Details"
                        className="p-1.5 border border-slate-800 rounded hover:text-accent hover:border-accent/40 bg-slate-950/40 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openResetModal(usr)}
                        title="Reset Password"
                        className="p-1.5 border border-slate-800 rounded hover:text-yellow-400 hover:border-yellow-400/40 bg-slate-950/40 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(usr)}
                        title={usr.is_active ? "Deactivate Account" : "Activate Account"}
                        className={`p-1.5 border border-slate-800 rounded bg-slate-950/40 cursor-pointer ${
                          usr.is_active ? "hover:text-red-400 hover:border-red-400/40" : "hover:text-green-400 hover:border-green-400/40"
                        }`}
                      >
                        {usr.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      {usr.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(usr.id, usr.username)}
                          title="Delete Account"
                          className="p-1.5 border border-slate-800 rounded hover:text-red-500 hover:border-red-500/40 bg-slate-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECURITY LOGS VIEW */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6 glass-panel relative overflow-hidden">
        <div className="h-1 bg-amber-500 absolute top-0 left-0 w-full" />
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <span>Login History & Activity Logs</span>
            </h4>
            <p className="text-[10px] text-slate-500">Immutable security logs of actions and events</p>
          </div>
          <button 
            onClick={fetchData}
            className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 border border-slate-800 rounded-lg hover:text-white"
          >
            Refresh Logs
          </button>
        </div>

        <div className="overflow-y-auto max-h-85 border border-slate-800 rounded-xl bg-slate-950/20">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800 bg-slate-950/80 sticky top-0">
              <tr>
                <th className="py-2.5 pl-3">Timestamp</th>
                <th className="py-2.5">User</th>
                <th className="py-2.5">Security Event</th>
                <th className="py-2.5 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/5">
                  <td className="py-2.5 text-slate-500 pl-3">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 font-bold text-slate-300">
                    {log.username}
                  </td>
                  <td className="py-2.5 text-slate-400">
                    {log.event}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex items-center space-x-1 font-bold ${
                      log.status === "Success" ? "text-green-400" :
                      log.status === "Failure" ? "text-red-400" : "text-amber-400"
                    }`}>
                      {log.status === "Success" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span className="text-[9px] uppercase">{log.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel relative">
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 border-b border-slate-800 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Create Bank Officer</h3>
            </div>
            
            {errorMsg && (
              <div className="mx-6 mt-4 p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg text-center font-mono">
                {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Corporate Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username</label>
                <input
                  required
                  type="text"
                  placeholder="ramesh_kumar"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Corporate Email</label>
                <input
                  required
                  type="email"
                  placeholder="username@canarabank.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role Security Clearance</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white cursor-pointer"
                >
                  <option value="Underwriter">Underwriter (Process Scans)</option>
                  <option value="Auditor">Auditor (Check Compliance)</option>
                  <option value="Admin">Admin (Control Settings)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Initial Security Password</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-accent text-slate-950 font-bold rounded-lg text-xs hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 cursor-pointer"
              >
                {actionLoading ? "Registering clearance keycard..." : "Generate & Authorize Credentials"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel relative">
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 border-b border-slate-800 flex items-center space-x-2">
              <Edit2 className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-ellipsis overflow-hidden">
                Edit Officer: {selectedUser.username}
              </h3>
            </div>
            
            {errorMsg && (
              <div className="mx-6 mt-4 p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg text-center font-mono">
                {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Corporate Full Name</label>
                <input
                  required
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Corporate Email</label>
                <input
                  required
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role Security Clearance</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white cursor-pointer"
                >
                  <option value="Underwriter">Underwriter (Process Scans)</option>
                  <option value="Auditor">Auditor (Check Compliance)</option>
                  <option value="Admin">Admin (Control Settings)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-accent text-slate-950 font-bold rounded-lg text-xs hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 cursor-pointer"
              >
                {actionLoading ? "Updating database..." : "Update Clearance Details"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel relative">
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsResetOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 border-b border-slate-800 flex items-center space-x-2">
              <Lock className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-ellipsis overflow-hidden">
                Reset Credentials: {selectedUser.username}
              </h3>
            </div>
            
            {errorMsg && (
              <div className="mx-6 mt-4 p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg text-center font-mono">
                {errorMsg}
              </div>
            )}
            
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">New Security Password</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-lg text-xs transition-all duration-300 cursor-pointer"
              >
                {actionLoading ? "Updating credentials..." : "Reset Security Password"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
