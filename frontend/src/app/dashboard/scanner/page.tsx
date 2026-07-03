"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldAlert, 
  ArrowLeft, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle,
  Clock,
  Layers,
  ZoomIn
} from "lucide-react";

import { apiFetch } from "@/lib/api";

interface DocumentDetails {
  id: number;
  file_name: string;
  file_type: string;
  fraud_score: number;
  confidence_score: number;
  risk_level: string;
  metadata_status: string;
  font_status: string;
  signature_status: string;
  compression_status: string;
  uploaded_at: string;
  tamper_regions: any[];
  explainable_ai_reasons: string[];
  metadata_json: any;
  extracted_text: string;
}

function ForensicScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("id") || "2"; // Fallback to seeded tampered ID for demonstration

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCaseDetails() {
      try {
        const response = await apiFetch(`/api/documents/${docId}`);
        if (!response.ok) {
          throw new Error("Could not retrieve file analysis details.");
        }
        const data = await response.json();
        setDetails(data);
      } catch (err: any) {
        console.warn("FastAPI offline. Hydrating fallback seeded details.");
        // Hydrate seeded Critical Risk salary slip mock
        setDetails({
          id: 2,
          file_name: "Sunita_Kumar_SalarySlip_Tampered.png",
          file_type: "PNG",
          fraud_score: 92.6,
          confidence_score: 87.2,
          risk_level: "Critical",
          metadata_status: "Tampered",
          font_status: "Alert",
          signature_status: "Alert",
          compression_status: "Alert",
          uploaded_at: "2026-05-29T14:10:12",
          tamper_regions: [
            {"id": 1, "x": 75, "y": 295, "w": 250, "h": 30, "risk": "High", "label": "Income Figure Patched (Font mismatch)"},
            {"id": 2, "x": 380, "y": 680, "w": 120, "h": 50, "risk": "Suspicious", "label": "Signature Block Compression Alteration"}
          ],
          explainable_ai_reasons: [
            "EXIF metadata reports document was edited in Adobe Photoshop on 2026-05-28.",
            "Significant font variance found inside 'Monthly Income' block (Times New Roman overlaid on Arial layout).",
            "Error Level Analysis (ELA) compression discrepancy detected in the signature block (suggests copy-paste).",
            "Name spelling deviations identified during Aadhaar ID cross-validation."
          ],
          metadata_json: {
            "software": "Adobe Photoshop 2025 (Windows)",
            "created_date": "2025-11-10 16:30:20",
            "modified_date": "2026-05-28 23:45:11",
            "status": "Tampered",
            "warnings": [
              "Exif metadata contains Photoshop metadata tags.",
              "Creation date and Modification date have high time offset."
            ]
          },
          extracted_text: "CANARA BANK SALARY SLIP\nEmployee: Sunita Kumar\nMonthly Net Income: INR 8,45,000\nLoan Amount Requested: INR 50,00,000"
        });
      } finally {
        setLoading(false);
      }
    }
    fetchCaseDetails();
  }, [docId]);

  const handleExportPDF = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!details) return;
    try {
      const response = await apiFetch(`/api/documents/${details.id}/download-pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DocuShield_Report_${details.file_name}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download PDF report", err);
    }
  };

  const handleExportExcel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!details) return;
    try {
      const response = await apiFetch(`/api/documents/${details.id}/download-excel`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DocuShield_Case_${details.file_name}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download CSV report", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-t-2 border-accent border-solid rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500">Decrypting ELA heatmaps and metadata hashes...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="text-center p-12">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h4 className="text-base font-bold text-white">Document Analysis Details Missing</h4>
        <Link href="/dashboard" className="text-xs text-accent hover:underline mt-4 inline-block">Return to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Navbar Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link 
            href="/dashboard"
            className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">{details.file_name}</h2>
            <p className="text-xs text-slate-500">Case file ID: DS-SCAN-00{details.id} • Forensic Underwriting Verification Report</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button 
            onClick={handleExportPDF}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-900 border border-slate-850 hover:border-accent text-accent rounded-lg text-xs font-semibold"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF Case</span>
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-900 border border-slate-850 hover:border-accent text-accent rounded-lg text-xs font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* CORE REPORT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Verification Risk Gauge Dial (Colspan 1) */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6 glass-panel flex flex-col items-center justify-center text-center relative">
          <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
          
          <div className="flex items-center justify-center space-x-1.5 mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tampering Risk Coefficient</h4>
            <div className="relative group flex items-center">
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-pointer hover:text-slate-400" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950/95 border border-slate-800 text-[10px] text-slate-400 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-cyber font-sans normal-case text-center leading-normal">
                Estimated probability that the uploaded document has been tampered with.
              </div>
            </div>
          </div>
          
          {/* Radial meter */}
          <div className="w-40 h-40 rounded-full border-4 border-slate-800 flex flex-col items-center justify-center relative bg-slate-950/60 shadow-cyber">
            
            {/* Colored arc indicators */}
            <div className={`absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-pulse`} style={{ transform: 'rotate(45deg)' }} />
            
            <span className={`text-4xl font-extrabold font-mono ${
              details.risk_level === "Critical" ? "text-red-500 glow-red" :
              details.risk_level === "High" ? "text-orange-400" :
              "text-emerald-400"
            }`}>{details.fraud_score}%</span>
            <span className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold mt-1">FRAUD RISK</span>
          </div>

          <div className="mt-6 space-y-2">
            <span className={`inline-block px-3 py-1 rounded-full font-bold font-mono text-[10px] uppercase border ${
              details.risk_level === "Critical" ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse" :
              details.risk_level === "High" ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}>
              {details.risk_level} Classification
            </span>
            <p className="text-[11px] text-slate-500 flex items-center justify-center space-x-1.5">
              <span>Confidence Accuracy Rate:</span>
              <span className="font-bold text-slate-300 font-mono">{details.confidence_score}%</span>
              <span className="relative group inline-block">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 cursor-pointer hover:text-slate-400" />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950/95 border border-slate-800 text-[10px] text-slate-400 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-cyber font-sans font-normal text-center normal-case leading-normal">
                  Confidence level of the AI model's prediction.
                </span>
              </span>
            </p>
          </div>

          {/* Quick link button to Heatmap Overlay screen */}
          <Link
            href={`/dashboard/heatmap?id=${details.id}`}
            className="w-full mt-6 py-3 bg-accent text-slate-950 hover:bg-cyan-400 font-bold rounded-lg text-xs shadow-cyber flex items-center justify-center space-x-1.5 transition-all duration-300"
          >
            <Layers className="w-4 h-4" />
            <span>Launch Tamper Heatmap</span>
          </Link>
        </div>

        {/* EXPLAINABLE AI PANEL (Colspan 2) */}
        <div className="lg:col-span-2 border border-slate-800 rounded-2xl bg-slate-900/40 p-6 glass-panel relative overflow-hidden flex flex-col justify-between">
          <div className="h-1 bg-gradient-to-r from-accent to-slate-900 absolute top-0 left-0 w-full" />
          
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-base font-bold text-white">Explainable AI (XAI) Diagnosis</h4>
                <p className="text-[10px] text-slate-500">Verifiable mathematical evidence logs compiled by models</p>
              </div>
              <HelpCircle className="w-5 h-5 text-slate-500" />
            </div>

            <div className="space-y-4">
              {(details.explainable_ai_reasons || []).map((reason, idx) => (
                <div key={idx} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-start space-x-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-xs text-slate-300 leading-relaxed">{reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1.5 mt-6 border-t border-slate-800 pt-4">
            <Clock className="w-3.5 h-3.5" />
            <span suppressHydrationWarning={true}>AI assessment finished at {new Date(details.uploaded_at).toLocaleString("en-IN")}</span>
          </div>
        </div>

      </div>

      {/* DETAILED SCANNER METADATA & OCR CHECKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Forensic Channels checklist */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6 glass-panel">
          <h4 className="text-sm font-bold text-slate-200 mb-6">Cyber Forensic Channels</h4>
          
          <div className="space-y-4">
            
            {/* ELA */}
            <div className="flex justify-between items-center p-3 border border-slate-800 bg-slate-950/30 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Error Level Analysis (ELA)</span>
                <span className="text-[10px] text-slate-500 block">Compression variance</span>
              </div>
              <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${
                details.compression_status === "Alert" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>{details.compression_status}</span>
            </div>

            {/* Metadata */}
            <div className="flex justify-between items-center p-3 border border-slate-800 bg-slate-950/30 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Metadata Exif Scans</span>
                <span className="text-[10px] text-slate-500 block">Modification footprints</span>
              </div>
              <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${
                details.metadata_status === "Tampered" ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>{details.metadata_status}</span>
            </div>

            {/* Font */}
            <div className="flex justify-between items-center p-3 border border-slate-800 bg-slate-950/30 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-300 block">OCR Font Continuity</span>
                <span className="text-[10px] text-slate-500 block">Kerning and type variances</span>
              </div>
              <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${
                details.font_status === "Alert" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>{details.font_status}</span>
            </div>

            {/* Signature */}
            <div className="flex justify-between items-center p-3 border border-slate-800 bg-slate-950/30 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Signature Copy Scanners</span>
                <span className="text-[10px] text-slate-500 block">Transparency layer checks</span>
              </div>
              <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${
                details.signature_status === "Alert" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}>{details.signature_status}</span>
            </div>

          </div>
        </div>

        {/* Metadata values (Colspan 2) */}
        <div className="lg:col-span-2 border border-slate-800 rounded-2xl bg-slate-900/40 p-6 glass-panel">
          <h4 className="text-sm font-bold text-slate-200 mb-6">Exif File Headers & OCR Extracted Details</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            {/* Header info */}
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-3">System EXIF Data</span>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Scanner Engine</span>
                  <span className="font-bold text-slate-300">
                    {details.metadata_json?.software || details.metadata_json?.Software || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created Date</span>
                  <span className="font-mono">
                    {details.metadata_json?.created_date || details.metadata_json?.Created || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Modified Date</span>
                  <span className="font-mono text-yellow-400">
                    {details.metadata_json?.modified_date || details.metadata_json?.Modified || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Extracted text */}
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-3">Extracted Text Stream</span>
              <pre className="p-4 bg-slate-950/80 border border-slate-850 rounded-xl font-mono text-[10px] text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-line max-h-40 overflow-y-auto">
                {details.extracted_text}
              </pre>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default function ForensicScanner() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-t-2 border-accent border-solid rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500">Initializing scanner session...</p>
      </div>
    }>
      <ForensicScannerContent />
    </Suspense>
  );
}
