"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Mail, ShieldCheck, AlertTriangle } from "lucide-react";

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 relative">
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        
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
          <div className="text-center mb-6">
            <div className="inline-flex p-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Self-Registration Disabled</h3>
            <p className="text-xs text-slate-500 mt-1">Reserve Bank of India (RBI) Access Control Directive Section 12.A</p>
          </div>

          <div className="space-y-4 text-xs text-slate-300">
            <div className="p-4 border border-slate-800 bg-slate-950/60 rounded-xl space-y-2">
              <p className="font-semibold text-slate-200">Security Access Policy</p>
              <p className="leading-relaxed text-slate-400">
                To prevent unauthorized access, DocuShield AI restricts account creation solely to Bank Managers (Administrators). 
                Officers, Underwriters, and Auditors cannot self-register.
              </p>
            </div>

            <div className="p-4 border border-slate-800 bg-slate-950/60 rounded-xl space-y-3">
              <p className="font-semibold text-slate-200 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>How to Request Access:</span>
              </p>
              <p className="text-slate-400 leading-relaxed">
                Contact your branch Bank Manager or IT Administrator. Send an email to the Security operations team with the following details:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
                <li><strong className="text-slate-300">Full Name:</strong> Your official bank record name</li>
                <li><strong className="text-slate-300">Corporate Email:</strong> Official `@canarabank.in` email address</li>
                <li><strong className="text-slate-300">Username:</strong> Your requested login username</li>
                <li><strong className="text-slate-300">Role Clearance:</strong> `Underwriter` (process scans) or `Auditor` (read-only audit trails)</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="mailto:admin.security@canarabank.in?subject=DocuShield%20AI%20Access%20Request"
                className="flex-1 py-3 bg-accent text-slate-950 font-bold rounded-lg text-sm shadow-cyber hover:bg-cyan-400 hover:shadow-cyberGlow transition-all duration-300 flex justify-center items-center space-x-2 animate-pulse"
              >
                <Mail className="w-4 h-4" />
                <span>Email IT Administrator</span>
              </a>
              
              <Link
                href="/login"
                className="flex-1 py-3 bg-slate-950 border border-slate-800 text-slate-300 font-semibold rounded-lg text-sm hover:bg-slate-900 transition-all flex justify-center items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
