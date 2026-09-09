"use client";

import { useState, useEffect } from "react";

export interface BudgetFormData {
  id?: string;
  category: string;
  monthly_limit: number | string;
}

interface AddBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: BudgetFormData | null;
}

export default function AddBudgetModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddBudgetModalProps) {
  const [category, setCategory] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setCategory(initialData.category || "");
      setMonthlyLimit(String(initialData.monthly_limit || ""));
    } else {
      setCategory("");
      setMonthlyLimit("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/budgets";
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload = isEditing
        ? {
            id: initialData!.id,
            category,
            monthly_limit: parseFloat(monthlyLimit),
          }
        : {
            category,
            monthly_limit: parseFloat(monthlyLimit),
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        alert(isEditing ? "Failed to update budget" : "Failed to save budget target");
      }
    } catch (err) {
      console.error("Error saving budget:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Category Budget" : "Set Category Budget"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Category Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Groceries, Dining Out, Shopping, Utilities"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Monthly Limit ($)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="500.00"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
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
              className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Update Budget" : "Save Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
