"use client";

import { useState, useEffect } from "react";

export interface RuleFormData {
  id?: string;
  keyword: string;
  category: string;
}

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: RuleFormData | null;
}

export default function AddRuleModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddRuleModalProps) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setKeyword(initialData.keyword || "");
      setCategory(initialData.category || "");
    } else {
      setKeyword("");
      setCategory("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/rules";
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload = isEditing
        ? { id: initialData!.id, keyword, category }
        : { keyword, category };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || (isEditing ? "Failed to update rule" : "Failed to create rule"));
      }
    } catch (err: any) {
      console.error("Error saving rule:", err);
      alert(err.message || "Network error while saving rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Categorization Rule" : "Add Categorization Rule"}
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
              If Merchant Contains (Keyword)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. amazon, uber, netflix, whole foods"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
            <p className="text-[11px] text-gray-400 mt-1">Case-insensitive partial match on merchant name.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Assign Category
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Shopping, Transport, Dining Out, Entertainment"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
              {isSubmitting ? "Saving..." : isEditing ? "Update Rule" : "Save Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
