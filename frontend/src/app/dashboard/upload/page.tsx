"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, File, AlertCircle, CheckCircle, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api";

export default function DocumentUpload() {
  const router = useRouter();
  
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File extension validations
  const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "tiff"];

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
    setError("");
    setSuccess(false);

    const validFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || "";
      const isValid = allowedExtensions.includes(ext);
      if (!isValid) {
        setError(`Format of '${file.name}' is invalid. Supported: PDF, JPG, PNG, TIFF`);
      }
      return isValid;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(10);
    setError("");

    try {
      // Setup Form Data
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      // Simulating incremental progress
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 80) {
            clearInterval(progressTimer);
            return 80;
          }
          return prev + 15;
        });
      }, 300);

      // Post to FastAPI backend using apiFetch wrapper
      const response = await apiFetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        throw new Error("Tamper scanning failed. Confirm system backend connection.");
      }

      setUploadProgress(100);
      setSuccess(true);
      setSelectedFiles([]);
      
      let targetId = "";
      try {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const doc = data[0];
          targetId = doc.id || doc.document_id || "";
        }
      } catch (e) {
        console.warn("Error parsing upload response JSON", e);
      }

      // Auto-redirect to scanner page or dashboard home after brief sleep
      setTimeout(() => {
        if (targetId) {
          router.push(`/dashboard/scanner?id=${targetId}`);
        } else {
          router.push("/dashboard");
        }
      }, 1500);

    } catch (err: any) {
      setError(err.message);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">Upload Underwriting Loan Scans</h2>
        <p className="text-xs text-slate-500">Secure banking ingestion shield accepting PDF, JPG, PNG, and TIFF formats</p>
      </div>

      <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md shadow-2xl glass-panel relative overflow-hidden">
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>Loan document tamper scanning finished! Opening scanner...</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        {!uploading && !success && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
              dragActive 
                ? "border-accent bg-cyan-950/20 shadow-cyber" 
                : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
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
            
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 mb-4 shadow-cyber">
              <UploadCloud className="w-10 h-10 text-accent animate-pulse" />
            </div>
            
            <h4 className="text-sm font-bold text-slate-200 mb-1">Drag and Drop Loan Documents Here</h4>
            <p className="text-xs text-slate-500 mb-4">or click to browse your desktop file manager</p>
            
            <span className="text-[10px] text-slate-600 uppercase font-mono tracking-wider">
              Maximum upload: 4 files • Max file size: 10MB
            </span>
          </div>
        )}

        {/* Upload progress indicator */}
        {uploading && (
          <div className="py-12 flex flex-col items-center justify-center">
            <UploadCloud className="w-12 h-12 text-accent animate-bounce mb-4" />
            <h4 className="text-sm font-bold text-slate-200 mb-2">Analyzing Document Integrity...</h4>
            <p className="text-xs text-slate-500 mb-6">Running Error Level Analysis (ELA) and layout font scans</p>
            
            <div className="w-full max-w-md bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-850">
              <div 
                className="bg-accent h-full shadow-cyberGlow transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold font-mono text-slate-400 mt-2">{uploadProgress}% Complete</span>
          </div>
        )}

        {/* Selected files listing */}
        {selectedFiles.length > 0 && !uploading && (
          <div className="mt-8 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Selected Ingestion Queue</h5>
            
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950/40 p-4">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <File className="w-5 h-5 text-accent shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block max-w-[250px] truncate">{file.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFile(idx)}
                    className="p-2 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleUploadSubmit}
              className="w-full mt-6 py-3.5 bg-accent text-slate-950 hover:bg-cyan-400 font-extrabold rounded-xl text-sm shadow-cyber transition-all duration-300 hover:shadow-cyberGlow"
            >
              Analyze Files for Forgery
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
