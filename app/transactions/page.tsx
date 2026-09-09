"use client";

import { useState, useEffect } from "react";
import AddEntryModal, { TransactionFormData } from "../components/AddEntryModal";
import ImportCsvModal from "../components/ImportCsvModal";
import { useCurrency } from "../context/CurrencyContext";

interface Transaction {
  id: string;
  amount: number | string;
  merchant: string;
  source: string;
  filename?: string;
  category: string;
  date: string;
  type: "income" | "expense";
}

interface ImportedFile {
  filename: string;
  count: number;
  start_date: string;
  end_date: string;
  imported_at: string;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[monthIdx] || "Jan"} ${day}, ${year}`;
  }
  return dateStr;
}

export default function TransactionsPage() {
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<TransactionFormData | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
  const [cleaningFile, setCleaningFile] = useState<string | null>(null);

  const fetchTransactions = () => {
    fetch("/api/transactions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .catch((err) => console.error("Failed to load transactions", err));

    fetchImportedFiles();
  };

  const fetchImportedFiles = () => {
    fetch("/api/transactions?files=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setImportedFiles(data);
      })
      .catch((err) => console.error("Failed to load imported files", err));
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleOpenAdd = () => {
    setEditingTxn(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setEditingTxn({
      id: t.id,
      amount: t.amount,
      merchant: t.merchant,
      category: t.category,
      date: t.date,
      type: t.type,
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        fetchImportedFiles();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Clean a particular file
  const handleCleanSpecificFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to remove all transactions imported from "${filename}"?`)) return;
    setCleaningFile(filename);
    try {
      const res = await fetch(`/api/transactions?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Successfully cleaned transactions from ${filename}`);
        fetchTransactions();
      } else {
        alert(data.error || "Failed to clean this file.");
      }
    } catch (err) {
      console.error("Clean file error:", err);
      alert("An error occurred while cleaning this file.");
    } finally {
      setCleaningFile(null);
    }
  };

  // Remove duplicate transactions
  const handleDedupe = async () => {
    setIsDeduping(true);
    try {
      const res = await fetch("/api/transactions?dedupe=true", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Removed duplicate transactions.");
        fetchTransactions();
      } else {
        alert(data.error || "Failed to remove duplicates.");
      }
    } catch (err) {
      console.error("Dedupe error:", err);
      alert("Failed to remove duplicate transactions.");
    } finally {
      setIsDeduping(false);
    }
  };

  // Clear all imported transactions
  const handleClearImports = async () => {
    if (!confirm("Are you sure you want to remove ALL imported transactions?")) return;
    setIsClearing(true);
    try {
      const res = await fetch("/api/transactions?imports=true", { method: "DELETE" });
      if (res.ok) {
        fetchTransactions();
        setIsFilesModalOpen(false);
      }
    } catch (err) {
      console.error("Clear imports error:", err);
    } finally {
      setIsClearing(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const matchesCat = filterCategory === "all" || t.category === filterCategory;
    const matchesSearch =
      (t.merchant || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.source || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.filename || "").toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const categories = Array.from(new Set(transactions.map((t) => t.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Review, edit, search, and bulk-import bank & credit card statements with automated de-duplication.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {importedFiles.length > 0 && (
            <button
              onClick={() => setIsFilesModalOpen(true)}
              className="border border-purple-200 bg-purple-50 hover:bg-purple-100 text-[#6558D3] px-4 py-2.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>📁</span> Uploaded Files ({importedFiles.length})
            </button>
          )}

          <button
            onClick={() => setIsImportOpen(true)}
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-full text-sm font-medium transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <span>📥</span> Import Statement (PDF / Excel / CSV / Doc)
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition shadow-sm cursor-pointer"
          >
            + Add entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Search merchant, UPI payee, file, or details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30"
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold uppercase text-gray-400">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-[#6558D3]/30"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No transactions found. Click &quot;Import Statement&quot; or &quot;+ Add entry&quot; above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="p-4">Date</th>
                  <th className="p-4">Merchant / Payee Details</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Source / File</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => {
                  const displayFile = t.filename || t.source;
                  const isImported =
                    displayFile &&
                    (displayFile.includes(".pdf") ||
                      displayFile.includes(".csv") ||
                      displayFile.includes(".xls") ||
                      displayFile.includes(".PDF") ||
                      displayFile.startsWith("Import"));

                  return (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap font-medium">
                        {formatDisplayDate(t.date)}
                      </td>
                      <td className="p-4 text-sm font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          {t.merchant.includes("(UPI)") && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              UPI
                            </span>
                          )}
                          <span>{t.merchant}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                          {t.category}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {isImported ? (
                          <div className="flex items-center gap-1.5 max-w-[240px]" title={displayFile}>
                            <span className="text-sm">📄</span>
                            <span className="truncate font-medium text-gray-700 bg-gray-50 border border-gray-200/80 px-2 py-0.5 rounded-lg text-[11px]">
                              {displayFile}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">{t.source}</span>
                        )}
                      </td>
                      <td className={`p-4 text-sm font-bold text-right whitespace-nowrap ${t.type === "expense" ? "text-gray-900" : "text-emerald-600"}`}>
                        {t.type === "expense" ? "-" : "+"}
                        {formatCurrency(Number(t.amount))}
                      </td>
                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="text-xs text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2 py-1 rounded-md transition cursor-pointer font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Uploaded Files Manager Modal */}
      {isFilesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Uploaded Statements & Files</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Clean transactions from a particular file or manage your statement imports.
                </p>
              </div>
              <button
                onClick={() => setIsFilesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {importedFiles.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No imported files found.
                </div>
              ) : (
                importedFiles.map((file) => (
                  <div
                    key={file.filename}
                    className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/70 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📄</span>
                        <p className="text-sm font-bold text-gray-900 truncate" title={file.filename}>
                          {file.filename}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        <strong>{file.count}</strong> transactions
                        {file.start_date && file.end_date && ` • ${file.start_date} to ${file.end_date}`}
                      </p>
                      {file.imported_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Imported on {file.imported_at}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleCleanSpecificFile(file.filename)}
                      disabled={cleaningFile === file.filename}
                      className="border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      <span>🗑️</span> {cleaningFile === file.filename ? "Cleaning..." : "Clean this file"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDedupe}
                  disabled={isDeduping}
                  className="text-xs text-[#6558D3] hover:text-[#5244bd] font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <span>🧹</span> {isDeduping ? "Removing duplicates..." : "Remove Duplicate Entries"}
                </button>
                {importedFiles.length > 0 && (
                  <button
                    onClick={handleClearImports}
                    disabled={isClearing}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    {isClearing ? "Clearing..." : "⚠️ Clear all files"}
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsFilesModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <AddEntryModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingTxn(null);
        }}
        onSuccess={fetchTransactions}
        initialData={editingTxn}
      />
      <ImportCsvModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={fetchTransactions} />
    </div>
  );
}
