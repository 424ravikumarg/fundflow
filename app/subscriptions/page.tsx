"use client";

import { useState, useEffect } from "react";
import AddSubscriptionModal, { SubscriptionFormData } from "../components/AddSubscriptionModal";
import { useCurrency } from "../context/CurrencyContext";

interface Subscription {
  id: string;
  name: string;
  amount: number | string;
  billing_cycle: "monthly" | "yearly";
  category: string;
  next_billing_date: string;
  status: string;
}

export default function SubscriptionsPage() {
  const { formatCurrency } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionFormData | null>(null);

  const fetchSubscriptions = () => {
    fetch("/api/subscriptions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSubscriptions(data);
      })
      .catch((err) => console.error("Failed to load subscriptions", err));
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleOpenAdd = () => {
    setEditingSub(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub({
      id: sub.id,
      name: sub.name,
      amount: sub.amount,
      billing_cycle: sub.billing_cycle,
      category: sub.category,
      next_billing_date: sub.next_billing_date,
      status: sub.status,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;

    try {
      const res = await fetch(`/api/subscriptions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Delete subscription error:", err);
    }
  };

  // Projected Monthly Commitment calculation
  const totalMonthlyCost = subscriptions.reduce((sum, s) => {
    const cost = Number(s.amount);
    return sum + (s.billing_cycle === "yearly" ? cost / 12 : cost);
  }, 0);

  const totalYearlyCost = totalMonthlyCost * 12;

  // Days remaining calculation helper
  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscriptions & Recurring</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track fixed monthly and annual commitments, renewals, and software fees.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          + Add subscription
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Monthly Commitment</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(totalMonthlyCost)}</p>
          <p className="text-xs text-gray-400 mt-1">Normalized to /month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Annual Projected</p>
          <p className="text-2xl font-bold mt-1 text-[#6558D3]">{formatCurrency(totalYearlyCost)}</p>
          <p className="text-xs text-gray-400 mt-1">Total 12-month spend</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Active Subscriptions</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{subscriptions.length}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">All active</p>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No recurring subscriptions added yet. Click &quot;+ Add subscription&quot; above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="p-4">Service</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Billing Cycle</th>
                  <th className="p-4">Next Renewal</th>
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subscriptions.map((sub) => {
                  const daysLeft = getDaysUntil(sub.next_billing_date);

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 text-sm font-semibold text-gray-900">
                        {sub.name}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                          {sub.category}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600 capitalize">
                        {sub.billing_cycle}
                      </td>
                      <td className="p-4 text-sm text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(sub.next_billing_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              daysLeft <= 3
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : daysLeft <= 7
                                ? "bg-amber-50 text-amber-600 border border-amber-200"
                                : "bg-purple-50 text-[#6558D3]"
                            }`}
                          >
                            {daysLeft === 0
                              ? "Due today"
                              : daysLeft < 0
                              ? "Past due"
                              : `in ${daysLeft}d`}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                        {formatCurrency(Number(sub.amount))}
                        <span className="text-xs text-gray-400 font-normal">
                          /{sub.billing_cycle === "yearly" ? "yr" : "mo"}
                        </span>
                      </td>
                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(sub)}
                          className="text-xs text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2 py-1 rounded-md transition cursor-pointer font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
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

      <AddSubscriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSub(null);
        }}
        onSuccess={fetchSubscriptions}
        initialData={editingSub}
      />
    </div>
  );
}
