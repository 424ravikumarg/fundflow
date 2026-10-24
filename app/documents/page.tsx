"use client";

import { useState, useEffect } from "react";
import ViewDocumentModal from "../components/ViewDocumentModal";
import ParseStatementModal from "../components/ParseStatementModal";

interface DocumentItem {
  id: string;
  filename: string;
  s3_key: string;
  file_type: string;
  file_size: number;
  parsed_text: string;
  created_at: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [parsingDoc, setParsingDoc] = useState<DocumentItem | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<DocumentItem | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchDocuments();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to process document");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading file");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleStartRename = (doc: DocumentItem) => {
    setRenamingDoc(doc);
    setNewDocName(doc.filename);
  };

  const handleRenameSubmit = async () => {
    if (!renamingDoc || !newDocName.trim()) return;

    setIsRenaming(true);
    try {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renamingDoc.id, filename: newDocName.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === renamingDoc.id ? { ...d, filename: newDocName.trim() } : d))
        );
        setRenamingDoc(null);
      } else {
        alert(data.error || "Failed to rename document");
      }
    } catch (err) {
      console.error("Rename error:", err);
      alert("Error renaming document");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents Vault & Reader</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload PDF bills, Excel spreadsheets, Word invoices, or receipts to automatically extract readable text and data.
          </p>
        </div>

        <label className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm cursor-pointer self-start sm:self-auto flex items-center gap-2">
          <span>{isUploading ? "Reading & Parsing..." : "+ Upload document"}</span>
          <input
            type="file"
            accept=".pdf, .xlsx, .xls, .docx, .txt, .csv"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Supported Formats Info Banner */}
      <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs text-purple-900">
        <div className="flex items-center gap-2">
          <span className="text-base">📂</span>
          <span>
            Supported file readers: <b>PDF</b> (.pdf), <b>Excel</b> (.xlsx, .xls), <b>Word</b> (.docx), and <b>CSV</b> (.csv).
          </span>
        </div>
        <span className="font-semibold text-[#6558D3]">Encrypted & Stored in AWS S3 Vault</span>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No documents uploaded yet. Upload your first PDF, Excel, or Word statement above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="p-4">File Name</th>
                  <th className="p-4">Format</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Date Uploaded</th>
                  <th className="p-4 text-center">Extracted Text</th>
                  <th className="p-4 text-center">Ledger Parsing</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <span>
                        {doc.file_type === "PDF"
                          ? "📄"
                          : ["XLSX", "XLS", "CSV"].includes(doc.file_type)
                          ? "📊"
                          : "📑"}
                      </span>
                      <span className="truncate max-w-xs">{doc.filename}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{formatFileSize(doc.file_size)}</td>
                    <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(doc.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <span>👁️</span> Raw Text
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setParsingDoc(doc)}
                        className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-3.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 mx-auto shadow-2xs"
                      >
                        <span>⚡</span> Parse Transactions
                      </button>
                    </td>
                    <td className="p-4 text-center space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleStartRename(doc)}
                        className="text-xs text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2.5 py-1 rounded-md transition cursor-pointer font-semibold"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-md transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ViewDocumentModal
        isOpen={Boolean(selectedDoc)}
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />

      <ParseStatementModal
        isOpen={Boolean(parsingDoc)}
        document={parsingDoc}
        onClose={() => setParsingDoc(null)}
        onImportSuccess={() => {
          fetchDocuments();
        }}
      />

      {/* Rename Document Modal */}
      {renamingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Rename Document</h3>
            <p className="text-xs text-gray-500 mb-4">
              Enter a new name for this file in your Document Vault.
            </p>
            <input
              type="text"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 font-medium mb-4"
              placeholder="e.g. Axis_Bank_October_2026.pdf"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenamingDoc(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={isRenaming || !newDocName.trim()}
                className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isRenaming ? "Saving..." : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
