"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, User, Mail, Lock, Shield } from "lucide-react";

import { apiFetch } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(""); // Admin, Underwriter, Auditor
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Registration failed. Try again.");
      }

      alert("Clearance request registered successfully. Proceed to Login using 123456 as OTP.");
      router.push("/login");
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

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-slate-200">Registration Portal</h3>
              <p className="text-xs text-slate-500">Apply for security clearance keycards</p>
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
                  placeholder="Choose username"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Bank Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="username@canarabank.in"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose strong password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Assigned Role</label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <select
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-accent outline-none rounded-lg pl-10 pr-4 py-2.5 text-sm text-white transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select Assigned Role</option>
                  <option value="Underwriter">Underwriter (Process Scans)</option>
                  <option value="Auditor">Auditor (Check Compliance)</option>
                  <option value="Admin">Admin (Control Settings)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-slate-950 font-bold rounded-lg text-sm shadow-cyber hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 flex justify-center items-center"
            >
              {loading ? "Registering user record..." : "Request Underwriting Clearance"}
            </button>

            <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-800/60">
              Already have keycard access? <Link href="/login" className="text-accent hover:underline">Log In</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
