"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "../context/CurrencyContext";

export interface ParsedTxnRow {
  date: string;
  merchant: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  source?: string;
  selected?: boolean;
}

interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
}

interface ParseStatementModalProps {
  isOpen: boolean;
  document: DocumentItem | null;
  onClose: () => void;
  onImportSuccess?: () => void;
}

const CATEGORIES = [
  "General",
  "Food & Dining",
  "Groceries",
  "Shopping",
  "Transportation",
  "Utilities",
  "Subscriptions",
  "Bills & Cards",
  "Healthcare",
  "Investments",
  "Entertainment",
  "Taxes & Govt",
  "Salary & Income",
];

export default function ParseStatementModal({
  isOpen,
  document,
  onClose,
  onImportSuccess,
}: ParseStatementModalProps) {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ParsedTxnRow[]>([]);
  const [metrics, setMetrics] = useState<{
    totalTransactions: number;
    creditCount: number;
    debitCount: number;
    totalIncome: number;
    totalExpense: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    insertedCount: number;
    duplicateCount: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen && document) {
      setError(null);
      setImportResult(null);
      setPassword("");
      handleParse();
    }
  }, [isOpen, document]);

  const handleParse = async (pwd?: string) => {
    if (!document) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${document.id}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd || password || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse transactions");
      }

      const rows: ParsedTxnRow[] = (data.transactions || []).map((t: any) => ({
        ...t,
        selected: true,
      }));

      setTransactions(rows);
      setMetrics(data.metrics || null);
    } catch (err: any) {
      setError(err.message || "Failed to extract transactions from document.");
      setTransactions([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setTransactions((prev) => prev.map((t) => ({ ...t, selected: checked })));
  };

  const handleToggleRow = (index: number) => {
    setTransactions((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleFieldChange = (
    index: number,
    field: keyof ParsedTxnRow,
    value: any
  ) => {
    setTransactions((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, [field]: value } : t))
    );
  };

  const handleImport = async () => {
    if (!document) return;
    const selectedRows = transactions.filter((t) => t.selected);
    if (selectedRows.length === 0) {
      alert("Please select at least one transaction to import.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${document.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: selectedRows }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import transactions");
      }

      setImportResult({
        insertedCount: data.insertedCount,
        duplicateCount: data.duplicateCount,
      });

      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen || !document) return null;

  const selectedCount = transactions.filter((t) => t.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-purple-100 text-[#6558D3] rounded-2xl text-xl">
              ⚡
            </span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Statement Parser & Transaction Importer
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                Extracting structured financial records from: <b className="text-gray-700">{document.filename}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Loading Indicator */}
          {loading && (
            <div className="py-16 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#6558D3] border-t-transparent"></div>
              <p className="text-sm font-semibold text-gray-700">
                Parsing Statement Rows, Tables & Columns...
              </p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Running optical layout parser across Axis, SBI, Amex, HDFC, and universal bank formats.
              </p>
            </div>
          )}

          {/* Password Protection Prompt */}
          {error && error.toLowerCase().includes("password") && !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <span>🔒</span>
                <span>Protected Statement File</span>
              </div>
              <p className="text-xs text-amber-700">
                This document requires a password to unlock (usually your Date of Birth, PAN, or account number).
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter document password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={() => handleParse(password)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Unlock & Parse
                </button>
              </div>
            </div>
          )}

          {/* Generic Error Notice */}
          {error && !error.toLowerCase().includes("password") && !loading && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-700 flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button
                onClick={() => handleParse()}
                className="text-xs font-semibold underline hover:text-rose-900 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Import Success Banner */}
          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                <span>✅</span>
                <span>Import Complete!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Successfully inserted <b>{importResult.insertedCount}</b> new transactions into your ledger.
                {importResult.duplicateCount > 0 && (
                  <span> ({importResult.duplicateCount} duplicate records were safely skipped).</span>
                )}
              </p>
              <div className="pt-2">
                <a
                  href="/transactions"
                  className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-xs font-semibold transition"
                >
                  View Transactions Ledger →
                </a>
              </div>
            </div>
          )}

          {/* Metrics Summary Strip */}
          {metrics && !loading && !importResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Total Parsed
                </span>
                <p className="text-lg font-bold text-gray-900 mt-0.5">
                  {metrics.totalTransactions} transactions
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Total Debits
                </span>
                <p className="text-lg font-bold text-rose-600 mt-0.5">
                  {formatCurrency(metrics.totalExpense)}
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Total Credits
                </span>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">
                  {formatCurrency(metrics.totalIncome)}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-100 p-3.5 rounded-2xl">
                <span className="text-[11px] font-semibold text-[#6558D3] uppercase tracking-wider">
                  Selected to Import
                </span>
                <p className="text-lg font-bold text-[#6558D3] mt-0.5">
                  {selectedCount} of {transactions.length}
                </p>
              </div>
            </div>
          )}

          {/* Extracted Transactions Review Table */}
          {!loading && !importResult && transactions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={selectedCount === transactions.length && transactions.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded text-[#6558D3] focus:ring-[#6558D3]"
                  />
                  <span>Select All ({transactions.length})</span>
                </label>
                <span>Edit any field directly before importing</span>
              </div>

              <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-[45vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50/80 sticky top-0 border-b border-gray-100 text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3 w-8 text-center"></th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Merchant / Narration</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50/50 transition ${
                          tx.selected ? "bg-white" : "opacity-40 bg-gray-50/30"
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(tx.selected)}
                            onChange={() => handleToggleRow(idx)}
                            className="rounded text-[#6558D3] focus:ring-[#6558D3]"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="date"
                            value={tx.date}
                            onChange={(e) => handleFieldChange(idx, "date", e.target.value)}
                            className="bg-transparent border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={tx.merchant}
                            onChange={(e) => handleFieldChange(idx, "merchant", e.target.value)}
                            className="w-full bg-transparent border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 font-medium focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={tx.type}
                            onChange={(e) => handleFieldChange(idx, "type", e.target.value)}
                            className="bg-transparent border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 font-medium focus:bg-white"
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={tx.category}
                            onChange={(e) => handleFieldChange(idx, "category", e.target.value)}
                            className="bg-transparent border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:bg-white"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={tx.amount}
                            onChange={(e) =>
                              handleFieldChange(idx, "amount", parseFloat(e.target.value) || 0)
                            }
                            className={`w-24 text-right bg-transparent border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:bg-white ${
                              tx.type === "income" ? "text-emerald-600" : "text-gray-900"
                            }`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && !importResult && transactions.length === 0 && !error && (
            <div className="py-12 text-center text-gray-400 text-xs">
              No transactions detected in this document.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-white transition cursor-pointer"
          >
            {importResult ? "Close" : "Cancel"}
          </button>

          {!importResult && transactions.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{importing ? "Importing to Ledger..." : `Import ${selectedCount} Transaction(s)`}</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
