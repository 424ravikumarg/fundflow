"use client";

import { useState, useEffect, useMemo } from "react";
import AddSubscriptionModal, { SubscriptionFormData } from "../components/AddSubscriptionModal";
import { useCurrency } from "../context/CurrencyContext";
import { DetectedRecurringSubscription } from "@/lib/recurring-detector";

interface Subscription {
  id: string;
  name: string;
  amount: number | string;
  billing_cycle: "monthly" | "yearly";
  category: string;
  next_billing_date: string;
  status: string;
}

interface Transaction {
  id: string;
  amount: number | string;
  merchant: string;
  category: string;
  date: string;
  type: "income" | "expense";
}

export default function RecurringPage() {
  const { formatCurrency } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionFormData | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [detectedItems, setDetectedItems] = useState<DetectedRecurringSubscription[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isDetectModalOpen, setIsDetectModalOpen] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high">("all");

  const fetchSubscriptions = () => {
    fetch("/api/subscriptions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSubscriptions(data);
      })
      .catch((err) => console.error("Failed to load subscriptions", err));
  };

  const fetchTransactions = () => {
    fetch("/api/transactions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .catch((err) => console.error("Failed to load transactions", err));
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchTransactions();
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
    if (!confirm("Are you sure you want to delete this recurring item?")) return;

    try {
      const res = await fetch(`/api/subscriptions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error("Delete subscription error:", err);
    }
  };

  // 1. Calculations for Monthly & Annual commitments
  const totalMonthlyCost = subscriptions.reduce((sum, s) => {
    const cost = Number(s.amount);
    return sum + (s.billing_cycle === "yearly" ? cost / 12 : cost);
  }, 0);

  const totalYearlyCost = totalMonthlyCost * 12;

  // Days remaining helper
  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 2. Upcoming Renewals in the next 7 days
  const upcomingThisWeek = useMemo(() => {
    return subscriptions.filter((sub) => {
      const days = getDaysUntil(sub.next_billing_date);
      return days >= 0 && days <= 7;
    });
  }, [subscriptions]);

  const upcomingCostThisWeek = upcomingThisWeek.reduce((sum, s) => sum + Number(s.amount), 0);

  // 3. Automated Recurring Detection using Intelligence Engine
  const handleScanForRecurring = async () => {
    setIsDetecting(true);
    try {
      const res = await fetch("/api/subscriptions/detect");
      const data = await res.json();
      if (data.success && Array.isArray(data.detected)) {
        setDetectedItems(data.detected);
        setIsDetectModalOpen(true);
      } else {
        alert(data.error || "Failed to scan recurring patterns.");
      }
    } catch (err) {
      console.error("Scan recurring error:", err);
      alert("Error scanning transactions for recurring patterns");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleAddDetected = async (item: DetectedRecurringSubscription) => {
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.cleanMerchant,
          amount: item.averageAmount,
          billing_cycle: item.cadence,
          category: item.category,
          next_billing_date: item.predictedNextRenewalDate,
        }),
      });

      if (res.ok) {
        fetchSubscriptions();
        setDetectedItems((prev) => prev.filter((d) => d.id !== item.id));
      }
    } catch (err) {
      console.error("Failed to add detected recurring item:", err);
    }
  };

  const handleAddAllHighConfidence = async () => {
    const highConf = detectedItems.filter((d) => d.confidenceLevel === "high");
    for (const item of highConf) {
      await handleAddDetected(item);
    }
  };

  // 4. Export iCal (.ics) Calendar
  const handleExportICal = () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Fundflow//Recurring Bills//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Fundflow Recurring Bills",
    ];

    subscriptions.forEach((sub) => {
      const renewalDate = new Date(sub.next_billing_date);
      const dateStr = renewalDate.toISOString().replace(/[-:]/g, "").split("T")[0];

      lines.push(
        "BEGIN:VEVENT",
        `UID:fundflow-recurring-${sub.id}@fundflow.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `SUMMARY:Renewal: ${sub.name} (${formatCurrency(Number(sub.amount))})`,
        `DESCRIPTION:Recurring ${sub.billing_cycle} payment for ${sub.name}. Category: ${sub.category}.`,
        `CATEGORIES:${sub.category}`,
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:Reminder: ${sub.name} renews in 3 days.`,
        "END:VALARM",
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join(String.fromCharCode(10))], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "fundflow-recurring-schedule.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchSearch =
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCategory === "all" || sub.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [subscriptions, searchQuery, filterCategory]);

  const categories = Array.from(new Set(subscriptions.map((s) => s.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recurring Finances & Bills</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage, edit ongoing subscriptions, recurring utilities, billing renewals, and calendar reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScanForRecurring}
            disabled={isDetecting}
            className="bg-purple-50 hover:bg-purple-100 text-[#6558D3] border border-purple-200 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
          >
            <span>{isDetecting ? "⏳" : "⚡"}</span>
            <span>{isDetecting ? "Analyzing patterns..." : "Recurring Intelligence"}</span>
          </button>
          <button
            onClick={handleExportICal}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>📅</span> Sync Calendar (.ics)
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            + Add recurring bill
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Monthly Run-Rate</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(totalMonthlyCost)}</p>
          <p className="text-xs text-gray-400 mt-1">Normalized to /month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Annual Run-Rate</p>
          <p className="text-2xl font-bold mt-1 text-[#6558D3]">{formatCurrency(totalYearlyCost)}</p>
          <p className="text-xs text-gray-400 mt-1">Total 12-month projection</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Commitments</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{subscriptions.length}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Managed automatically</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Due in Next 7 Days</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{upcomingThisWeek.length}</p>
          <p className="text-xs text-gray-400 mt-1">Totaling {formatCurrency(upcomingCostThisWeek)}</p>
        </div>
      </div>

      {/* Due Soon Alert Banner */}
      {upcomingThisWeek.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {upcomingThisWeek.length} bill{upcomingThisWeek.length > 1 ? "s" : ""} renewing this week
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {upcomingThisWeek.map((s) => `${s.name} (${formatCurrency(Number(s.amount))})`).join(", ")}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-200/80 px-3 py-1 rounded-full whitespace-nowrap">
            {formatCurrency(upcomingCostThisWeek)} due soon
          </span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search recurring bills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition cursor-pointer ${
              filterCategory === "all"
                ? "bg-[#6558D3] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition cursor-pointer ${
                filterCategory === cat
                  ? "bg-[#6558D3] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredSubscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No recurring bills found matching your filter. Click &quot;+ Add recurring bill&quot; above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="p-4">Service / Bill</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Billing Cycle</th>
                  <th className="p-4">Next Renewal</th>
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSubscriptions.map((sub) => {
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

      {/* Recurring Intelligence Auto-Detection Modal */}
      {isDetectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-purple-100 text-[#6558D3] rounded-xl text-lg">⚡</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Recurring Intelligence Engine</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Analyzed historical transaction intervals, cadences & merchant patterns
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetectModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter & Batch Actions Bar */}
            <div className="py-3 flex items-center justify-between border-b border-gray-50 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfidenceFilter("all")}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    confidenceFilter === "all"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All Patterns ({detectedItems.length})
                </button>
                <button
                  onClick={() => setConfidenceFilter("high")}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    confidenceFilter === "high"
                      ? "bg-[#6558D3] text-white"
                      : "bg-purple-50 text-[#6558D3] hover:bg-purple-100"
                  }`}
                >
                  High Confidence ({detectedItems.filter((d) => d.confidenceLevel === "high").length})
                </button>
              </div>

              {detectedItems.some((d) => d.confidenceLevel === "high") && (
                <button
                  onClick={handleAddAllHighConfidence}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-semibold transition cursor-pointer text-xs flex items-center gap-1 shadow-2xs"
                >
                  <span>✨</span> Track All High-Confidence
                </button>
              )}
            </div>

            <div className="space-y-3 py-4 overflow-y-auto flex-1">
              {detectedItems.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs space-y-1">
                  <p className="text-base">🎉</p>
                  <p className="font-semibold text-gray-700">No new recurring subscriptions detected!</p>
                  <p>All identified repeating expenses are already tracked in your subscriptions ledger.</p>
                </div>
              ) : (
                (confidenceFilter === "high"
                  ? detectedItems.filter((d) => d.confidenceLevel === "high")
                  : detectedItems
                ).map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-2.5 hover:bg-white hover:shadow-xs transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">{item.cleanMerchant}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              item.confidenceLevel === "high"
                                ? "bg-emerald-100 text-emerald-700"
                                : item.confidenceLevel === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {Math.round(item.confidenceScore * 100)}% match
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Detected in statement as: <span className="text-gray-600 font-mono text-[11px]">{item.merchant}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(item.averageAmount)}
                        </p>
                        <p className="text-[11px] text-[#6558D3] font-medium">
                          ~{formatCurrency(item.normalizedMonthlyCost)}/mo
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-500 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-100/70 text-[#6558D3] px-2 py-0.5 rounded-md font-semibold capitalize">
                          {item.cadence}
                        </span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          {item.occurrenceCount} occurrences
                        </span>
                        <span className="text-gray-400">
                          Next est: <b>{new Date(item.predictedNextRenewalDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddDetected(item)}
                        className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>+ Track</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-400">
                Pattern matching accounts for intervals, payment gateways, and variance
              </span>
              <button
                onClick={() => setIsDetectModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Subscription Modal */}
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
