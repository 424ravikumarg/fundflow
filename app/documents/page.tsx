"use client";

import { useState, useEffect } from "react";
import ViewDocumentModal from "../components/ViewDocumentModal";

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
                        className="bg-[#6558D3]/10 hover:bg-[#6558D3]/20 text-[#6558D3] px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <span>👁️</span> View Extracted Content
                      </button>
                    </td>
                    <td className="p-4 text-center">
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
    </div>
  );
}
