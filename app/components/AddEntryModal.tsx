"use client";

import { useState, useEffect } from "react";

export interface TransactionFormData {
  id?: string;
  type: "income" | "expense";
  amount: number | string;
  merchant: string;
  category: string;
  date: string;
}

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: TransactionFormData | null;
}

function formatDateForInput(dateVal?: string) {
  if (!dateVal) return new Date().toISOString().split("T")[0];
  if (dateVal.includes("T")) return dateVal.split("T")[0];
  if (dateVal.length >= 10) return dateVal.substring(0, 10);
  return dateVal;
}

export default function AddEntryModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddEntryModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: "expense",
    amount: "",
    merchant: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        type: initialData.type || "expense",
        amount: String(initialData.amount || ""),
        merchant: initialData.merchant || "",
        category: initialData.category || "",
        date: formatDateForInput(initialData.date),
      });
    } else {
      setFormData({
        type: "expense",
        amount: "",
        merchant: "",
        category: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(formData.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/transactions";
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload = isEditing
        ? {
            id: formData.id,
            type: formData.type,
            amount: parseFloat(String(formData.amount)),
            merchant: formData.merchant,
            category: formData.category,
            date: formData.date,
          }
        : {
            type: formData.type,
            amount: parseFloat(String(formData.amount)),
            merchant: formData.merchant,
            category: formData.category,
            date: formData.date,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (response.ok) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const errJson = await response.json().catch(() => ({}));
        alert(errJson.error || (isEditing ? "Failed to update transaction" : "Failed to save transaction"));
      }
    } catch (error) {
      console.error("Error submitting transaction form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Transaction" : "Add New Entry"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="expense"
                checked={formData.type === "expense"}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="accent-[#6558D3]"
              />
              <span className="text-sm font-medium text-gray-700">Expense</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="income"
                checked={formData.type === "income"}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="accent-[#6558D3]"
              />
              <span className="text-sm font-medium text-gray-700">Income</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Merchant / Source</label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              placeholder="e.g. Amazon, Starbucks, Payroll"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Category</label>
            <input
              type="text"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              placeholder="e.g. Groceries, Dining Out, Salary, Utilities"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Date</label>
            <input
              type="date"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Update Transaction" : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
