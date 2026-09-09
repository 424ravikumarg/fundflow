"use client";

import { useState, useEffect } from "react";
import AddBudgetModal, { BudgetFormData } from "../components/AddBudgetModal";
import { useCurrency } from "../context/CurrencyContext";

interface Budget {
  id: string;
  category: string;
  monthly_limit: number | string;
  spent: number | string;
}

export default function BudgetsPage() {
  const { formatCurrency } = useCurrency();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetFormData | null>(null);

  const fetchBudgets = () => {
    fetch("/api/budgets")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBudgets(data);
      })
      .catch((err) => console.error("Failed to load budgets", err));
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleOpenAdd = () => {
    setEditingBudget(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Budget) => {
    setEditingBudget({
      id: b.id,
      category: b.category,
      monthly_limit: b.monthly_limit,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this budget target?")) return;

    try {
      const res = await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error("Delete budget error:", err);
    }
  };

  const totalBudgeted = budgets.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent), 0);
  const remaining = Math.max(0, totalBudgeted - totalSpent);
  const overallPercentage = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Budgets & Limits</h2>
          <p className="text-sm text-gray-500 mt-1">
            Set and edit monthly category spending caps and track progress in real time.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          + Set budget
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total Budgeted</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(totalBudgeted)}</p>
          <p className="text-xs text-gray-400 mt-1">Monthly total</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total Spent</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-gray-400 mt-1">This month&apos;s spending</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Remaining</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(remaining)}</p>
          <p className="text-xs text-gray-400 mt-1">Available to spend</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Overall Budget Usage</p>
          <p className="text-2xl font-bold mt-1 text-[#6558D3]">{overallPercentage}%</p>
          <p className="text-xs text-gray-400 mt-1">Cap used</p>
        </div>
      </div>

      {/* Category Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-400 text-sm">
            No spending limits configured yet. Click &quot;+ Set budget&quot; to begin!
          </div>
        ) : (
          budgets.map((b) => {
            const limit = Number(b.monthly_limit);
            const spent = Number(b.spent);
            const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const isOver = spent > limit;
            const isWarning = percent >= 80 && !isOver;

            return (
              <div
                key={b.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{b.category}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Monthly Spending Cap</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isOver
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : isWarning
                          ? "bg-amber-50 text-amber-600 border border-amber-200"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {isOver ? "Over Budget" : isWarning ? "Near Limit" : "On Track"}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline my-3">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(spent)}
                    </span>
                    <span className="text-sm font-medium text-gray-500">
                      of {formatCurrency(limit)} ({percent}%)
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? "bg-red-500"
                          : isWarning
                          ? "bg-amber-500"
                          : "bg-[#6558D3]"
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-50 text-xs text-gray-400">
                  <span>
                    {isOver
                      ? `${formatCurrency(spent - limit)} over budget`
                      : `${formatCurrency(limit - spent)} remaining`}
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleOpenEdit(b)}
                      className="text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2 py-1 rounded-md transition cursor-pointer font-semibold"
                    >
                      Edit Limit
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddBudgetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBudget(null);
        }}
        onSuccess={fetchBudgets}
        initialData={editingBudget}
      />
    </div>
  );
}
