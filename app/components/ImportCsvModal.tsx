"use client";

import { useState, useRef, useEffect } from "react";

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DuplicateInfo {
  filename: string;
  existingCount: number;
  error: string;
}

export default function ImportCsvModal({ isOpen, onClose, onSuccess }: ImportCsvModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statementType, setStatementType] = useState<"auto" | "bank" | "credit_card">("auto");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  // Password Protection States
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [incorrectPassword, setIncorrectPassword] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (requiresPassword && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [requiresPassword]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessCount(null);
    setSuccessMessage(null);
    setDuplicateInfo(null);
    setRequiresPassword(false);
    setPassword("");
    setIncorrectPassword(false);

    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async (overwrite: boolean = false) => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg(null);
    setDuplicateInfo(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("statementType", statementType);
    if (password) {
      formData.append("password", password);
    }
    if (overwrite) {
      formData.append("overwrite", "true");
    }

    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessCount(data.count ?? 0);
        setSuccessMessage(data.message || `Successfully imported ${data.count} transaction(s).`);
        setSelectedFile(null);
        setDuplicateInfo(null);
        setRequiresPassword(false);
        setPassword("");
        onSuccess();
        setTimeout(() => {
          onClose();
          setSuccessCount(null);
          setSuccessMessage(null);
        }, 1800);
      } else if (res.status === 401 && data.requiresPassword) {
        setRequiresPassword(true);
        setIncorrectPassword(Boolean(data.incorrectPassword));
        setErrorMsg(data.error || "This document requires a password.");
      } else if (res.status === 409 && data.isDuplicateFile) {
        setDuplicateInfo({
          filename: data.filename,
          existingCount: data.existingCount,
          error: data.error,
        });
      } else {
        setErrorMsg(data.error || "Failed to parse transactions from this file.");
      }
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg("A network error occurred while uploading.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCleanSpecificFile = async (filename: string) => {
    setIsCleaning(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/transactions?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Successfully cleaned transactions from ${filename}`);
        setDuplicateInfo(null);
        setSelectedFile(null);
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to clean this file.");
      }
    } catch (err) {
      console.error("Clean file error:", err);
      setErrorMsg("Failed to clean this file.");
    } finally {
      setIsCleaning(false);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) return '📊';
    if (ext === 'docx') return '📑';
    return '📁';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Import Financial Statement</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload Bank or Credit Card statements (PDF, Excel, Word, CSV).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 1. Success Screen */}
        {successCount !== null ? (
          <div className="py-8 text-center space-y-2 animate-in fade-in">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto">
              ✓
            </div>
            <h4 className="text-base font-bold text-gray-900">Import Complete!</h4>
            <p className="text-xs text-gray-600 max-w-sm mx-auto px-4">
              {successMessage || `Successfully imported ${successCount} transaction(s) into your account.`}
            </p>
          </div>
        ) : duplicateInfo ? (
          /* 2. Duplicate File Warning */
          <div className="p-5 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-4 animate-in fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Duplicate File Detected</h4>
                <p className="text-xs text-amber-800 mt-1">
                  <strong>&quot;{duplicateInfo.filename}&quot;</strong> has already been imported with{" "}
                  <strong>{duplicateInfo.existingCount} transaction(s)</strong>.
                </p>
                <p className="text-[11px] text-amber-700 mt-1">
                  To prevent duplicate entries, choose whether to replace the existing records or cancel.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-amber-200">
              <button
                onClick={() => handleImport(true)}
                disabled={isUploading}
                className="flex-1 bg-[#6558D3] hover:bg-[#5244bd] text-white py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
              >
                {isUploading ? "Replacing..." : "🔄 Replace / Re-Import"}
              </button>
              <button
                onClick={() => handleCleanSpecificFile(duplicateInfo.filename)}
                disabled={isCleaning}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
              >
                {isCleaning ? "Cleaning..." : "🗑️ Clean This File"}
              </button>
              <button
                onClick={() => setDuplicateInfo(null)}
                className="py-2 px-3 rounded-xl text-xs text-gray-600 hover:text-gray-800 cursor-pointer text-center font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : requiresPassword ? (
          /* 3. Password Prompt Popup */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 p-4 bg-purple-50/90 border border-purple-200 rounded-2xl">
              <span className="text-2xl">🔒</span>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Password-Protected Statement</h4>
                <p className="text-xs text-purple-900 mt-0.5">
                  <strong>{selectedFile?.name}</strong> is encrypted by your bank. Please enter the password to decrypt and import transactions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 block">
                Enter PDF Statement Password:
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setIncorrectPassword(false);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password) {
                      e.preventDefault();
                      handleImport(false);
                    }
                  }}
                  placeholder="e.g. DOB, Account No, or PAN"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none transition pr-10 ${
                    incorrectPassword
                      ? "border-rose-400 focus:ring-2 focus:ring-rose-400/30 bg-rose-50/30"
                      : "border-gray-300 focus:border-[#6558D3] focus:ring-2 focus:ring-[#6558D3]/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Common Bank Password Formats Hint */}
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-[11px] text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700">💡 Common Bank Password Hints:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-600 pl-1">
                  <li><strong>Axis Bank:</strong> First 4 letters of Name (CAPS) + Last 4 digits of Account, or DOB (DDMMYYYY)</li>
                  <li><strong>SBI / SBI Card:</strong> DOB (DDMM) + Last 4 digits of Card / Mobile No.</li>
                  <li><strong>HDFC Bank:</strong> Customer ID or First 4 letters of Name + DOB (DDMM)</li>
                  <li><strong>ICICI Bank:</strong> First 4 letters of Name + DOB (DDMM), or PAN (ALL CAPS)</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setRequiresPassword(false);
                  setPassword("");
                  setErrorMsg(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
              >
                Choose Another File
              </button>
              <button
                type="button"
                onClick={() => handleImport(false)}
                disabled={!password || isUploading}
                className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploading ? "Unlocking & Importing..." : "Unlock & Import Transactions"}
              </button>
            </div>
          </div>
        ) : (
          /* 4. Default Upload View */
          <div className="space-y-4">
            {/* Statement Type Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Statement Type:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatementType("auto")}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                    statementType === "auto"
                      ? "bg-purple-50 border-[#6558D3] text-[#6558D3]"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>🪄</span> Auto-Detect
                </button>
                <button
                  type="button"
                  onClick={() => setStatementType("bank")}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                    statementType === "bank"
                      ? "bg-purple-50 border-[#6558D3] text-[#6558D3]"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>🏦</span> Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => setStatementType("credit_card")}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                    statementType === "credit_card"
                      ? "bg-purple-50 border-[#6558D3] text-[#6558D3]"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>💳</span> Credit Card
                </button>
              </div>
            </div>

            {/* File Dropzone */}
            <label className="border-2 border-dashed border-gray-200 hover:border-[#6558D3] rounded-2xl p-7 flex flex-col items-center justify-center cursor-pointer transition bg-gray-50/50 hover:bg-purple-50/30">
              <span className="text-3xl mb-2">{selectedFile ? getFileIcon(selectedFile.name) : "📤"}</span>
              <span className="text-sm font-semibold text-gray-800 text-center px-4">
                {selectedFile ? selectedFile.name : "Click to select or drop statement file"}
              </span>
              <span className="text-xs text-gray-400 mt-1">
                Supports .pdf, .xlsx, .xls, .docx, .csv, .txt (up to 25MB)
              </span>
              <input
                type="file"
                accept=".pdf, .xlsx, .xls, .docx, .csv, .txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <div className="space-y-2">
                <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100 flex items-center justify-between text-xs text-purple-900">
                  <span className="font-semibold truncate max-w-[300px]">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-200/80 font-bold uppercase text-[10px]">
                    {selectedFile.name.split('.').pop()}
                  </span>
                </div>

                {/* Optional pre-emptive password prompt trigger for PDFs */}
                {selectedFile.name.toLowerCase().endsWith(".pdf") && (
                  <button
                    type="button"
                    onClick={() => setRequiresPassword(true)}
                    className="text-xs text-[#6558D3] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>🔒</span> File has a password? Click to enter password
                  </button>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <p className="font-semibold">{errorMsg}</p>
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
                onClick={() => handleImport(false)}
                disabled={!selectedFile || isUploading}
                className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isUploading ? "Extracting & Importing..." : "Extract & Save Transactions"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
