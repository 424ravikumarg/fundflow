"use client";

import { useState, useEffect } from "react";

export interface SubscriptionFormData {
  id?: string;
  name: string;
  amount: number | string;
  billing_cycle: "monthly" | "yearly";
  category: string;
  next_billing_date: string;
  status?: string;
}

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: SubscriptionFormData | null;
}

function formatDateForInput(dateVal?: string) {
  if (!dateVal) return new Date().toISOString().split("T")[0];
  if (dateVal.includes("T")) return dateVal.split("T")[0];
  if (dateVal.length >= 10) return dateVal.substring(0, 10);
  return dateVal;
}

export default function AddSubscriptionModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddSubscriptionModalProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [category, setCategory] = useState("Entertainment");
  const [nextBillingDate, setNextBillingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setAmount(String(initialData.amount || ""));
      setBillingCycle(initialData.billing_cycle || "monthly");
      setCategory(initialData.category || "Entertainment");
      setNextBillingDate(formatDateForInput(initialData.next_billing_date));
      setStatus(initialData.status || "active");
    } else {
      setName("");
      setAmount("");
      setBillingCycle("monthly");
      setCategory("Entertainment");
      setNextBillingDate(new Date().toISOString().split("T")[0]);
      setStatus("active");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/subscriptions";
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload = isEditing
        ? {
            id: initialData!.id,
            name,
            amount: parseFloat(amount),
            billing_cycle: billingCycle,
            category,
            next_billing_date: nextBillingDate,
            status,
          }
        : {
            name,
            amount: parseFloat(amount),
            billing_cycle: billingCycle,
            category,
            next_billing_date: nextBillingDate,
            status: "active",
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
        alert(errJson.error || (isEditing ? "Failed to update subscription" : "Failed to save subscription"));
      }
    } catch (err) {
      console.error("Error saving subscription:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Subscription" : "Add Subscription"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subscription Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Service / Bill Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Netflix, AWS, Gym, Spotify"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          {/* Amount & Cycle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="14.99"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Cycle
              </label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as "monthly" | "yearly")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            >
              <option value="Entertainment">Entertainment (Streaming, Music)</option>
              <option value="Cloud / SaaS">Cloud & Infrastructure (AWS, OpenAI)</option>
              <option value="Utilities">Utilities & Bills (Internet, Mobile)</option>
              <option value="Fitness">Fitness & Health (Gym, Sports)</option>
              <option value="Productivity">Work & Productivity</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Next Billing Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Next Billing Date
            </label>
            <input
              type="date"
              required
              value={nextBillingDate}
              onChange={(e) => setNextBillingDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          {/* Status if editing */}
          {isEditing && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Buttons */}
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
              {isSubmitting ? "Saving..." : isEditing ? "Update Subscription" : "Save Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
