"use client";

import { useState, useEffect, useMemo } from "react";
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

interface Transaction {
  id: string;
  amount: number | string;
  merchant: string;
  category: string;
  date: string;
  type: "income" | "expense";
}

interface DetectedRecurring {
  merchant: string;
  category: string;
  amount: number;
  frequency: "monthly" | "yearly" | "weekly";
  count: number;
  lastDate: string;
  predictedNextDate: string;
}

export default function RecurringPage() {
  const { formatCurrency } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionFormData | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [detectedItems, setDetectedItems] = useState<DetectedRecurring[]>([]);
  const [isDetectModalOpen, setIsDetectModalOpen] = useState(false);

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

  // 3. Automated Recurring Detection from Transactions
  const handleScanForRecurring = () => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const merchantMap = new Map<string, Transaction[]>();

    expenses.forEach((t) => {
      const m = (t.merchant || "").trim().toLowerCase();
      if (!m) return;
      if (!merchantMap.has(m)) merchantMap.set(m, []);
      merchantMap.get(m)!.push(t);
    });

    const detected: DetectedRecurring[] = [];

    merchantMap.forEach((txs, merchantKey) => {
      if (txs.length >= 2) {
        const alreadySubscribed = subscriptions.some(
          (s) => s.name.toLowerCase().includes(merchantKey) || merchantKey.includes(s.name.toLowerCase())
        );

        if (!alreadySubscribed) {
          const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const avgAmount = txs.reduce((sum, t) => sum + Number(t.amount), 0) / txs.length;
          const lastTx = sorted[sorted.length - 1];

          const nextD = new Date(lastTx.date);
          nextD.setDate(nextD.getDate() + 30);

          detected.push({
            merchant: lastTx.merchant,
            category: lastTx.category || "Subscriptions",
            amount: Math.round(avgAmount * 100) / 100,
            frequency: "monthly",
            count: txs.length,
            lastDate: lastTx.date,
            predictedNextDate: nextD.toISOString().split("T")[0],
          });
        }
      }
    });

    setDetectedItems(detected);
    setIsDetectModalOpen(true);
  };

  const handleAddDetected = async (item: DetectedRecurring) => {
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.merchant,
          amount: item.amount,
          billing_cycle: item.frequency,
          category: item.category,
          next_billing_date: item.predictedNextDate,
        }),
      });

      if (res.ok) {
        fetchSubscriptions();
        setDetectedItems((prev) => prev.filter((d) => d.merchant !== item.merchant));
      }
    } catch (err) {
      console.error("Failed to add detected recurring item:", err);
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
            className="bg-purple-50 hover:bg-purple-100 text-[#6558D3] border border-purple-200 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>✨</span> Auto-detect from transactions
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

      {/* Auto-Detection Modal */}
      {isDetectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Detected Recurring Transactions</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Transactions with repeating patterns found in your account
                </p>
              </div>
              <button
                onClick={() => setIsDetectModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {detectedItems.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No new recurring patterns detected from recent transactions.
                </div>
              ) : (
                detectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.merchant}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCurrency(item.amount)} / {item.frequency} • {item.count} occurrences
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddDetected(item)}
                      className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      + Track
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsDetectModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer"
              >
                Done
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
