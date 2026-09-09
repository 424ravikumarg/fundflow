"use client";

import { useState, useEffect } from "react";

export interface GoalFormData {
  id?: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  target_date: string;
}

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: GoalFormData | null;
}

function formatDateForInput(dateVal?: string | null) {
  if (!dateVal) return "";
  if (dateVal.includes("T")) return dateVal.split("T")[0];
  if (dateVal.length >= 10) return dateVal.substring(0, 10);
  return dateVal;
}

export default function AddGoalModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddGoalModalProps) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setTargetAmount(String(initialData.target_amount || ""));
      setCurrentAmount(String(initialData.current_amount || ""));
      setTargetDate(formatDateForInput(initialData.target_date));
    } else {
      setName("");
      setTargetAmount("");
      setCurrentAmount("");
      setTargetDate("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/goals";
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload = isEditing
        ? {
            id: initialData!.id,
            name,
            target_amount: parseFloat(targetAmount),
            current_amount: currentAmount ? parseFloat(currentAmount) : 0,
            target_date: targetDate,
          }
        : {
            name,
            target_amount: parseFloat(targetAmount),
            current_amount: currentAmount ? parseFloat(currentAmount) : 0,
            target_date: targetDate,
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
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || (isEditing ? "Failed to update goal" : "Failed to save goal"));
      }
    } catch (err) {
      console.error("Error saving goal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Financial Goal" : "Add Financial Goal"}
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
              Goal Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Emergency Fund, New Car"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Target Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="10000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Current Saved ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="1500"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Target Date
            </label>
            <input
              type="date"
              required
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
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
              {isSubmitting ? "Saving..." : isEditing ? "Update Goal" : "Save Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
