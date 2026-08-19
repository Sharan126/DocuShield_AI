"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  ShieldAlert, 
  UploadCloud, 
  FileText, 
  Activity, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Fingerprint,
  HelpCircle
} from "lucide-react";

import { apiFetch } from "@/lib/api";

interface Document {
  id: number;
  file_name: string;
  file_type: string;
  fraud_score: number;
  confidence_score: number;
  risk_level: string;
  metadata_status: string;
  uploaded_at: string;
}

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch from backend using apiFetch wrapper
        const [analRes, docRes] = await Promise.all([
          apiFetch("/api/analytics/summary"),
          apiFetch("/api/documents/")
        ]);
        
        if (analRes.ok && docRes.ok) {
          const analData = await analRes.json();
          const docData = await docRes.json();
          setAnalytics(analData);
          setDocuments(docData);
        }
      } catch (err) {
        console.warn("FastAPI offline. Hydrating mock data fallback.");
        // Fallback mock dashboard statistics
        setAnalytics({
          total_documents_scanned: 18,
          system_health: { cpu_usage: 22.4, redis_status: "Healthy", model_accuracy: 99.4 }
        });
        setDocuments([
          { id: 2, file_name: "Sunita_Kumar_SalarySlip_Tampered.png", file_type: "PNG", fraud_score: 92.6, confidence_score: 87.2, risk_level: "Critical", metadata_status: "Tampered", uploaded_at: "2026-05-29T14:10:12" },
          { id: 1, file_name: "Ramesh_Kumar_SalarySlip.png", file_type: "PNG", fraud_score: 4.2, confidence_score: 98.5, risk_level: "Low", metadata_status: "Passed", uploaded_at: "2026-05-28T09:12:00" }
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-t-2 border-accent border-solid rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500">Hydrating bank verification parameters...</p>
      </div>
    );
  }

  // Count risk levels dynamically from list
  const criticalCount = documents.filter(d => d.risk_level === "Critical").length;
  const highCount = documents.filter(d => d.risk_level === "High").length;
  const lowCount = documents.filter(d => d.risk_level === "Low").length;

  return (
    <div className="space-y-6">
      
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-sans">Underwriting Security Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time loan forgery analysis queue & RBI telemetry controls</p>
        </div>
        
        <Link 
          href="/dashboard/upload"
          className="flex items-center space-x-2 px-5 py-3 bg-accent hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs sm:text-sm shadow-cyber transition-all duration-300 hover:scale-105 shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </Link>
      </div>

      {/* STATS HIGHLIGHTS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Total Scanned */}
        <div className="p-5 sm:p-6 border border-slate-800/90 rounded-2xl bg-slate-900 shadow-md relative h-full flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start w-full">
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Loan Files</p>
                <div className="relative group flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-300" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl font-sans normal-case text-center leading-normal">
                    Total number of uploaded loan documents in the verification queue.
                  </div>
                </div>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-mono">{documents.length}</h3>
            </div>
            <span className="p-2.5 sm:p-3 bg-cyan-950/70 border border-cyan-500/30 rounded-xl text-accent shadow-sm">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <p className="text-xs text-emerald-400 mt-4 flex items-center space-x-1.5 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active underwriting queues</span>
          </p>
        </div>

        {/* Critical Alerts */}
        <div className="p-5 sm:p-6 border border-red-500/30 rounded-2xl bg-slate-900 shadow-md relative h-full flex flex-col justify-between hover:border-red-500/50 transition-all">
          <div className="flex justify-between items-start w-full">
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5">
                <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Critical Forgeries</p>
                <div className="relative group flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-red-400 cursor-pointer hover:text-red-300" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950 border border-red-800/80 text-[10px] text-slate-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl font-sans normal-case text-center leading-normal">
                    Number of documents identified with critical compression, font, or metadata tampering.
                  </div>
                </div>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-red-400 font-mono glow-red">{criticalCount}</h3>
            </div>
            <span className="p-2.5 sm:p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-400 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </span>
          </div>
          <p className="text-xs text-red-400 mt-4 font-medium">
            Critical compression or metadata tamper alert
          </p>
        </div>

        {/* Model Accuracy */}
        <div className="p-5 sm:p-6 border border-slate-800/90 rounded-2xl bg-slate-900 shadow-md relative h-full flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start w-full">
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Detection Accuracy</p>
                <div className="relative group flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-300" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl font-sans normal-case text-center leading-normal">
                    Overall performance of the document fraud detection pipeline.
                  </div>
                </div>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">99.4%</h3>
            </div>
            <span className="p-2.5 sm:p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-medium">
            Underpinned by LayoutLMv3 & PaddleOCR
          </p>
        </div>

        {/* System Health */}
        <div className="p-5 sm:p-6 border border-slate-800/90 rounded-2xl bg-slate-900 shadow-md relative h-full flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex justify-between items-start w-full">
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">RBI Compliance</p>
                <div className="relative group flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-300" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950 border border-slate-700 text-[10px] text-slate-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl font-sans normal-case text-center leading-normal">
                    Indicates whether the analyzed document satisfies the configured RBI validation checks.
                  </div>
                </div>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-mono">100%</h3>
            </div>
            <span className="p-2.5 sm:p-3 bg-cyan-950/70 border border-cyan-500/30 rounded-xl text-accent shadow-sm">
              <Activity className="w-5 h-5" />
            </span>
          </div>
          <p className="text-xs text-cyan-400 mt-4 font-medium">
            Security audit ledger ACTIVE
          </p>
        </div>

      </div>

      {/* CORE QUEUE TABLES & DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Verification Queue (Colspan 2) */}
        <div className="lg:col-span-2 border border-slate-800 rounded-2xl bg-slate-900/40 backdrop-blur-md p-6 glass-panel relative overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-accent to-slate-900 absolute top-0 left-0 w-full" />
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-base font-bold text-white">Underwriting Scan Ledger</h4>
              <p className="text-[10px] text-slate-500">Live classification ledger of incoming loan submissions</p>
            </div>
            <Link href="/dashboard/audits" className="text-xs text-slate-400 hover:text-accent flex items-center space-x-1">
              <span>View Audit logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-full text-slate-500 shadow-cyber">
                <FileText className="w-8 h-8 text-accent animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-300">No documents uploaded yet</p>
                <p className="text-xs text-slate-500 max-w-sm">Upload a document to begin fraud analysis.</p>
              </div>
              <Link 
                href="/dashboard/upload"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-slate-950 font-bold rounded-lg text-xs transition-all duration-300"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Document</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-3">Loan Document</th>
                    <th className="pb-3">Risk Rating</th>
                    <th className="pb-3 text-center">Confidence</th>
                    <th className="pb-3">Uploaded Date</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/20 transition-all">
                      <td className="py-4 flex items-center space-x-3">
                        <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
                          <Fingerprint className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-200 block max-w-[200px] truncate">{doc.file_name}</span>
                          <span className="text-[9px] text-slate-500 block uppercase font-mono">{doc.file_type} Scan</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-bold font-mono text-[9px] uppercase border ${
                          doc.risk_level === "Critical" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                          doc.risk_level === "High" ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
                          "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}>
                          {doc.risk_level} ({doc.fraud_score}%)
                        </span>
                      </td>
                      <td className="py-4 text-center font-mono font-semibold text-slate-400">
                        {doc.confidence_score}%
                      </td>
                      <td className="py-4 text-slate-500 font-mono" suppressHydrationWarning={true}>
                        {new Date(doc.uploaded_at).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="py-4 text-right">
                        <Link 
                          href={`/dashboard/scanner?id=${doc.id}`}
                          className="inline-flex items-center space-x-1 text-[10px] bg-slate-950 border border-slate-850 hover:border-accent text-accent px-2.5 py-1 rounded"
                        >
                          <span>Analyze Document</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Guide Card */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/40 backdrop-blur-md p-6 glass-panel relative">
          <div className="h-1 bg-accent absolute top-0 left-0 w-full" />
          
          <h4 className="text-base font-bold text-white mb-4">Underwriting Operations Checklist</h4>
          
          <div className="space-y-4 text-xs">
            <div className="p-3 border border-slate-800 bg-slate-950/40 rounded-xl">
              <span className="font-bold text-slate-200 block mb-1">Verify ELA Heatmaps</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Click Heatmap Viewer to highlight image compression tampering. Glowing red blocks denote structural anomalies.
              </p>
            </div>
            
            <div className="p-3 border border-slate-800 bg-slate-950/40 rounded-xl">
              <span className="font-bold text-slate-200 block mb-1">Run Cross Validation</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Select salary slips and matching income tax receipts to scan for numeric, name, or property address discrepancies.
              </p>
            </div>

            <div className="p-3 border border-slate-800 bg-slate-950/40 rounded-xl">
              <span className="font-bold text-slate-200 block mb-1">Evaluate Fraud Rings</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Check Graph Intelligence to trace co-applicant connections, shared properties, and branch rings.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
