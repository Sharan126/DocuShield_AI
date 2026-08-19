"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Key, User, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const authStore = useAuthStore();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://docushield-ai.onrender.com";

  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get("mode");
      const userParam = params.get("username");
      if (modeParam === "reset") {
        setMode("reset");
      }
      if (userParam) {
        setUsername(userParam);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      // Connect to FastAPI login
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Authentication failed. Verify credentials.");
      }

      const data = await response.json();
      const token = data.access_token;

      // Decode JWT payload to extract id, username, role, and name
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);

      // Save to Zustand and cookies/localStorage
      authStore.setAuth(token, {
        id: payload.id,
        username: payload.username,
        role: payload.role,
        name: payload.name,
      });

      if (payload.role === "Auditor") {
        router.push("/dashboard/audits");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/forgot-password?username=${encodeURIComponent(username)}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Verification request failed.");
      }

      const data = await response.json();
      setMessage(data.message || "Simulated verification link logged in system Audit Logs.");

      // Auto transition to reset password view after a short delay
      setTimeout(() => {
        setMode("reset");
        setMessage("");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, new_password: newPassword }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Password reset failed.");
      }

      const data = await response.json();
      setMessage(data.message || "Password updated successfully!");

      // Back to login after a short delay
      setTimeout(() => {
        setMode("login");
        setMessage("");
        setPassword("");
        setNewPassword("");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 relative">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* LOGO */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="p-3 bg-cyan-950/60 border border-accent/20 rounded-2xl mb-4 shadow-cyber">
            <ShieldAlert className="w-8 h-8 text-accent animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-wider text-white">
            DOCUSHIELD <span className="text-accent text-base">AI</span>
          </h2>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase">Canara Underwriting Security</p>
        </div>

        {/* CARD CONTAINER */}
        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-2xl glass-panel relative overflow-hidden scanline">
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg text-center">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg text-center">
              {message}
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-slate-200">System Authentication</h3>
                <p className="text-xs text-slate-500">Sign in to unlock forensic analysis sessions</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your system username"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-3 text-sm text-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Security Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-10 py-3 text-sm text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-accent transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" className="accent-accent" />
                  <span>Remember Session</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("forgot");
                  }}
                  className="hover:text-accent cursor-pointer outline-none"
                >
                  Reset Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent text-slate-950 font-bold rounded-lg text-sm shadow-cyber hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 flex justify-center items-center"
              >
                {loading ? "Authenticating credentials..." : "Access Secure Environment"}
              </button>

              <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-800/60">
                Need underwriter clearance? <Link href="/register" className="text-accent hover:underline">Request Access</Link>
              </div>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-slate-200">Reset Password Link</h3>
                <p className="text-xs text-slate-500">Request a verification link for your system account</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your system username"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-3 text-sm text-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent text-slate-950 font-bold rounded-lg text-sm shadow-cyber hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 flex justify-center items-center"
              >
                {loading ? "Requesting Link..." : "Request Reset Link"}
              </button>

              <div className="text-center text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("login");
                  }}
                  className="hover:text-accent underline outline-none"
                >
                  Back to Authentication
                </button>
              </div>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-slate-200">Configure Credentials</h3>
                <p className="text-xs text-slate-500">Update your security credentials for secure environment access</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Confirm your system username"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-3 text-sm text-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">New Security Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    required
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong new password"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-10 py-3 text-sm text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-accent transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent text-slate-950 font-bold rounded-lg text-sm shadow-cyber hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 flex justify-center items-center"
              >
                {loading ? "Configuring Credentials..." : "Update Security Credentials"}
              </button>

              <div className="text-center text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("login");
                  }}
                  className="hover:text-accent underline outline-none"
                >
                  Back to Authentication
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
