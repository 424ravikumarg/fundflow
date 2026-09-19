"use client";

import { useState, useRef } from "react";

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportCsvModal({ isOpen, onClose, onSuccess }: ImportCsvModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordFile, setPasswordFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const added = newFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...added];
      });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMessage(null);

    let totalImported = 0;
    const errors: string[] = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      if (password) {
        formData.append("password", password);
      }

      try {
        const res = await fetch("/api/transactions/import", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          totalImported += data.count || 0;
        } else if (res.status === 401 || data.requiresPassword || (data.error && data.error.toLowerCase().includes("password"))) {
          setRequiresPassword(true);
          setPasswordFile(file.name);
          setErrorMsg(`"${file.name}" is password-protected. Please enter the password below.`);
          setIsUploading(false);
          return;
        } else {
          errors.push(`${file.name}: ${data.error || "Failed to parse"}`);
        }
      } catch (err) {
        errors.push(`${file.name}: Network upload error`);
      }
    }

    setIsUploading(false);

    if (totalImported > 0) {
      setSuccessMessage(
        `Successfully imported ${totalImported} transaction(s) across ${selectedFiles.length} file(s)!`
      );
      setSelectedFiles([]);
      setPassword("");
      setRequiresPassword(false);
      setPasswordFile(null);
      onSuccess();
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1600);
    } else if (errors.length > 0) {
      setErrorMsg(errors.join(" | "));
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (["xlsx", "xls", "csv"].includes(ext || "")) return "📊";
    if (ext === "docx") return "📑";
    return "📁";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Import Financial Statements</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload bank or credit card statements (PDF, Excel, Word, CSV). Select one or multiple files.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {successMessage ? (
          <div className="py-8 text-center space-y-2 animate-in fade-in">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto">
              ✓
            </div>
            <h4 className="text-base font-bold text-gray-900">Import Complete!</h4>
            <p className="text-xs text-gray-600 max-w-sm mx-auto px-4">{successMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Multi-file Dropzone */}
            <label className="border-2 border-dashed border-gray-200 hover:border-[#6558D3] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-gray-50/50 hover:bg-purple-50/30">
              <span className="text-3xl mb-1.5">📤</span>
              <span className="text-sm font-semibold text-gray-800 text-center px-4">
                Click to select or drop statement file(s)
              </span>
              <span className="text-xs text-gray-400 mt-1 text-center">
                Supports multiple .pdf, .xlsx, .xls, .docx, .csv files at once
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf, .xlsx, .xls, .docx, .csv, .txt, .PDF, .XLSX, .XLS, .CSV"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-700 px-1">
                  <span>Selected Files ({selectedFiles.length})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-rose-600 hover:underline cursor-pointer text-[11px]"
                  >
                    Clear All
                  </button>
                </div>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between text-xs text-purple-900"
                  >
                    <div className="flex items-center gap-2 truncate max-w-[360px]">
                      <span>{getFileIcon(file.name)}</span>
                      <span className="font-semibold truncate">{file.name}</span>
                      <span className="text-gray-400 text-[10px]">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Password input if needed */}
            {requiresPassword && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span>🔒</span>
                  <span>Enter Password for {passwordFile || "PDF statement"}:</span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. DOB or PAN or Account number"
                  className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#6558D3]/30 bg-white"
                />
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <span>⚠️</span>
                <p className="font-semibold break-words">{errorMsg}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedFiles.length === 0 || isUploading}
                className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isUploading
                  ? "Extracting & Importing..."
                  : `Extract & Save ${selectedFiles.length > 1 ? `(${selectedFiles.length} Files)` : "Transactions"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
