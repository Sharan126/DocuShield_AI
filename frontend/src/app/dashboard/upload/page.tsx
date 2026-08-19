"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  UploadCloud, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  RefreshCw, 
  Activity, 
  Layers, 
  ShieldAlert,
  Server,
  FileCheck,
  X
} from "lucide-react";

import { apiFetch, checkBackendHealth } from "@/lib/api";

type BackendState = "checking" | "online" | "warming" | "offline";
type AnalysisStage = "uploading" | "ocr" | "ela" | "cross_val" | "scoring" | "completed";

export default function DocumentUpload() {
  const router = useRouter();
  
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [currentStage, setCurrentStage] = useState<AnalysisStage>("uploading");
  const [error, setError] = useState<{ message: string; type: "network" | "validation" | "server" | "auth" } | null>(null);
  const [success, setSuccess] = useState(false);

  // Backend connection health tracking
  const [backendState, setBackendState] = useState<BackendState>("checking");
  const [backendMessage, setBackendMessage] = useState("");
  const [retryingHealth, setRetryingHealth] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "tiff"];

  // Verify backend connectivity on mount
  useEffect(() => {
    runHealthCheck();
  }, []);

  const runHealthCheck = async () => {
    setRetryingHealth(true);
    setBackendState("checking");
    try {
      const health = await checkBackendHealth(8000);
      if (health.online) {
        setBackendState("online");
        setBackendMessage("Analysis engine connected and ready");
      } else {
        // If timed out, likely Render instance cold sleep
        setBackendState(health.message?.includes("timed out") ? "warming" : "offline");
        setBackendMessage(health.message || "Backend connection issue");
      }
    } catch {
      setBackendState("offline");
      setBackendMessage("Unable to reach backend service");
    } finally {
      setRetryingHealth(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    setError(null);
    setSuccess(false);

    // Limit max files
    if (selectedFiles.length + files.length > 4) {
      setError({
        message: "Maximum 4 documents can be uploaded per verification batch.",
        type: "validation"
      });
      return;
    }

    const validFiles: File[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || "";
      if (!allowedExtensions.includes(ext)) {
        setError({
          message: `'${file.name}' has an unsupported format. Allowed: PDF, JPG, PNG, TIFF.`,
          type: "validation"
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError({
          message: `'${file.name}' exceeds the 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB).`,
          type: "validation"
        });
        continue;
      }
      validFiles.push(file);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 || uploading) return;

    setUploading(true);
    setUploadProgress(15);
    setCurrentStage("uploading");
    setError(null);

    // Dynamic progress simulator with multi-stage underwriting steps
    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 40) {
          setCurrentStage("uploading");
          return prev + 8;
        } else if (prev < 65) {
          setCurrentStage("ocr");
          return prev + 5;
        } else if (prev < 85) {
          setCurrentStage("ela");
          return prev + 4;
        } else if (prev < 95) {
          setCurrentStage("cross_val");
          return prev + 2;
        }
        return 95;
      });
    }, 400);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await apiFetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        let errorDetail = "Tamper scanning failed. Confirm system backend connection.";
        try {
          const errData = await response.json();
          if (errData?.detail) {
            errorDetail = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            errorDetail = "Backend server is currently waking up or unavailable. Please retry in a moment.";
          }
        }

        throw new Error(errorDetail);
      }

      setCurrentStage("completed");
      setUploadProgress(100);
      setSuccess(true);
      setBackendState("online");

      let targetId = "";
      try {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const doc = data[0];
          targetId = doc.id || doc.document_id || "";
        }
      } catch (e) {
        console.warn("Could not parse response JSON", e);
      }

      // Auto redirect after brief pause to show completion
      setTimeout(() => {
        if (targetId) {
          router.push(`/dashboard/scanner?id=${targetId}`);
        } else {
          router.push("/dashboard");
        }
      }, 1200);

    } catch (err: any) {
      clearInterval(progressTimer);
      setUploadProgress(0);
      
      const errMsg = err?.message || "Failed to process files.";
      const isNetwork = errMsg.toLowerCase().includes("failed to fetch") || 
                        errMsg.toLowerCase().includes("network") ||
                        errMsg.toLowerCase().includes("unavailable") ||
                        errMsg.toLowerCase().includes("waking up");

      setError({
        message: errMsg,
        type: isNetwork ? "network" : "server"
      });

      if (isNetwork) {
        setBackendState("warming");
      }
    } finally {
      setUploading(false);
    }
  };

  const getStageDescription = () => {
    switch (currentStage) {
      case "uploading":
        return "Streaming document binary payload to secure ingestion buffer...";
      case "ocr":
        return "Running PaddleOCR layout analysis & extracting bounding boxes...";
      case "ela":
        return "Computing Error Level Analysis (ELA) 95% JPEG compression delta...";
      case "cross_val":
        return "Cross-referencing entities against active loan registry...";
      case "scoring":
        return "Calculating composite risk rating & generating explainability ledger...";
      case "completed":
        return "Forensic scan complete! Redirecting to case scanner...";
      default:
        return "Analyzing document integrity...";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Page Header with Backend Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-sans">
            Upload Underwriting Loan Scans
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Secure banking ingestion shield accepting PDF, JPG, PNG, and TIFF formats
          </p>
        </div>

        {/* Backend Connection Indicator */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <div className={`px-3 py-1.5 rounded-full border text-[11px] font-mono font-semibold flex items-center space-x-2 ${
            backendState === "online" 
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400" 
              : backendState === "warming"
              ? "bg-amber-950/60 border-amber-500/40 text-amber-400"
              : backendState === "checking"
              ? "bg-slate-900 border-slate-700 text-slate-400"
              : "bg-red-950/60 border-red-500/40 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              backendState === "online" 
                ? "bg-emerald-400" 
                : backendState === "warming"
                ? "bg-amber-400 animate-pulse"
                : backendState === "checking"
                ? "bg-slate-400 animate-spin"
                : "bg-red-400"
            }`} />
            <span>
              {backendState === "online" && "Engine Online"}
              {backendState === "warming" && "Engine Warming Up"}
              {backendState === "checking" && "Connecting..."}
              {backendState === "offline" && "Engine Offline"}
            </span>
          </div>

          {(backendState === "offline" || backendState === "warming") && (
            <button
              onClick={runHealthCheck}
              disabled={retryingHealth}
              title="Retry connection"
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retryingHealth ? "animate-spin text-accent" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Main Upload Card */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-800/90 bg-slate-900 shadow-xl relative overflow-hidden">
        
        {/* Render Cold Start / Warming Warning Banner */}
        {backendState === "warming" && (
          <div className="mb-6 p-4 bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <Server className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="font-bold text-amber-200">Backend instance is waking up from sleep</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                  The Render cloud backend spins down after periods of inactivity. Initial analysis may take 15–30 seconds to initialize.
                </p>
              </div>
            </div>
            <button 
              onClick={runHealthCheck}
              disabled={retryingHealth}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 text-[11px] font-semibold flex items-center space-x-1.5 shrink-0 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${retryingHealth ? "animate-spin" : ""}`} />
              <span>Ping Engine</span>
            </button>
          </div>
        )}

        {/* Actionable Error State Card */}
        {error && (
          <div className="mb-6 p-4 sm:p-5 bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-red-200 text-xs sm:text-sm">
                  {error.type === "network" ? "Connection / Analysis Interrupted" : "Document Validation Alert"}
                </p>
                <p className="text-[11px] text-red-300/90 mt-1 leading-relaxed max-w-xl">
                  {error.message}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
              {error.type === "network" && (
                <button
                  onClick={handleUploadSubmit}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 text-[11px] font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Analysis</span>
                </button>
              )}
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="mb-6 p-4 sm:p-5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center space-x-3 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-200 text-xs sm:text-sm">Document Analysis Verified</p>
              <p className="text-[11px] text-emerald-300/90 mt-0.5">
                Cryptographic signatures generated. Loading forensic case view...
              </p>
            </div>
          </div>
        )}

        {/* Interactive Drag and Drop Zone */}
        {!uploading && !success && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
              dragActive 
                ? "border-accent bg-cyan-950/30 shadow-cyber" 
                : "border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950/80"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.tiff"
            />
            
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-accent mb-4 shadow-cyber">
              <UploadCloud className="w-10 h-10 animate-pulse" />
            </div>
            
            <h4 className="text-sm sm:text-base font-bold text-white mb-1 text-center">
              Drag and Drop Loan Documents Here
            </h4>
            <p className="text-xs text-slate-400 mb-4 text-center">
              or click to browse your desktop file manager
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-500 uppercase font-mono tracking-wider">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">PDF</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">PNG</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">JPG</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">TIFF</span>
              <span>• Max 10MB per file</span>
            </div>
          </div>
        )}

        {/* Multi-Stage Analysis Progress State */}
        {uploading && (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-accent mb-5 shadow-cyber">
              <Layers className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            
            <h4 className="text-base sm:text-lg font-bold text-white mb-1.5">
              Forensic Integrity Pipeline Active
            </h4>
            <p className="text-xs text-slate-400 mb-6 max-w-md">
              {getStageDescription()}
            </p>
            
            {/* Progress bar */}
            <div className="w-full max-w-md bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 shadow-inner">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-accent h-full shadow-cyberGlow transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between w-full max-w-md text-xs font-mono mt-3 px-1">
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Processing Pipeline</span>
              <span className="text-accent font-bold">{uploadProgress}%</span>
            </div>
          </div>
        )}

        {/* Selected Ingestion Queue */}
        {selectedFiles.length > 0 && !uploading && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Selected Ingestion Queue ({selectedFiles.length})
              </h5>
              <button 
                onClick={() => setSelectedFiles([])}
                className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
            
            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/60 p-3 sm:p-4">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center space-x-3 min-w-0 pr-4">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-accent shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-200 block truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "Document"}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFile(idx)}
                    aria-label={`Remove ${file.name}`}
                    className="p-2 border border-slate-800 hover:border-red-500/50 text-slate-500 hover:text-red-400 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleUploadSubmit}
              className="w-full mt-6 py-4 bg-accent hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-sm sm:text-base shadow-cyber transition-all duration-300 hover:scale-[1.01] hover:shadow-cyberGlow flex items-center justify-center space-x-2"
            >
              <ShieldAlert className="w-5 h-5" />
              <span>Analyze Files for Forgery</span>
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
