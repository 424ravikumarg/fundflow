"use client";

import { useState, useEffect } from "react";
import AddGoalModal, { GoalFormData } from "../components/AddGoalModal";
import { useCurrency } from "../context/CurrencyContext";

interface Goal {
  id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  target_date: string;
}

export default function GoalsPage() {
  const { formatCurrency } = useCurrency();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalFormData | null>(null);

  const fetchGoals = async () => {
    try {
      const res = await fetch("/api/goals");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setGoals(data);
    } catch (err) {
      console.error("Failed to load goals:", err);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleOpenAdd = () => {
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (g: Goal) => {
    setEditingGoal({
      id: g.id,
      name: g.name,
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      target_date: g.target_date,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
      }
    } catch (err) {
      console.error("Delete goal error:", err);
    }
  };

  const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount), 0);
  const totalCurrent = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Goals</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track and edit your savings milestones, target amounts, and completion dates.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          + Add goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total Target</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total Saved</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(totalCurrent)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Overall Progress</p>
          <p className="text-2xl font-bold mt-1 text-[#6558D3]">{overallProgress}%</p>
        </div>
      </div>

      {/* Goals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-400 text-sm">
            No financial goals created yet. Click &quot;+ Add goal&quot; above!
          </div>
        ) : (
          goals.map((g) => {
            const target = Number(g.target_amount);
            const current = Number(g.current_amount);
            const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const isCompleted = current >= target;

            return (
              <div key={g.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{g.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Target Date: {new Date(g.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-[#6558D3]"}`}>
                      {isCompleted ? "Completed 🎉" : `${percent}% Saved`}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline my-3">
                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(current)}</span>
                    <span className="text-sm font-medium text-gray-500">of {formatCurrency(target)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#6558D3] rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-50 text-xs text-gray-400">
                  <span>{isCompleted ? "Goal achieved!" : `${formatCurrency(target - current)} remaining`}</span>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2 py-1 rounded-md transition cursor-pointer font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
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

      <AddGoalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onSuccess={fetchGoals}
        initialData={editingGoal}
      />
    </div>
  );
}
