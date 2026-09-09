"use client";

import { useState, useEffect } from "react";
import AddRuleModal, { RuleFormData } from "../components/AddRuleModal";

interface Rule {
  id: string;
  keyword: string;
  category: string;
  created_at: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleFormData | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/rules");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRules(data);
      }
    } catch (err) {
      console.error("Failed to load rules:", err);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleOpenAdd = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: Rule) => {
    setEditingRule({
      id: r.id,
      keyword: r.keyword,
      category: r.category,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("Delete rule error:", err);
    }
  };

  const handleApplyRulesToAll = async () => {
    setIsApplying(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/rules/apply", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setStatusMessage(`Successfully updated categories across ${data.updatedCount} transaction(s)!`);
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        alert("Failed to apply rules.");
      }
    } catch (err) {
      console.error("Apply rules error:", err);
    } finally {
      setIsApplying(false);
    }
  };

  const uniqueCategories = Array.from(new Set(rules.map((r) => r.category))).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Categorization Rules</h2>
          <p className="text-sm text-gray-500 mt-1">
            Automatically classify transactions into categories based on merchant keyword matching.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleApplyRulesToAll}
            disabled={isApplying || rules.length === 0}
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-full text-sm font-medium transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isApplying ? "Applying Rules..." : "⚡ Run on all transactions"}
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition shadow-sm cursor-pointer"
          >
            + Add rule
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl animate-in fade-in">
          ✓ {statusMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Active Rules</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{rules.length}</p>
          <p className="text-xs text-gray-400 mt-1">Keyword match filters</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Categories Covered</p>
          <p className="text-2xl font-bold mt-1 text-[#6558D3]">{uniqueCategories}</p>
          <p className="text-xs text-gray-400 mt-1">Target category buckets</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Engine Mode</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">Active</p>
          <p className="text-xs text-emerald-600 mt-1">Auto-categorizing new entries</p>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No rules set up yet. Click &quot;+ Add rule&quot; to automate your transaction categorization!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="p-4">Merchant Keyword</th>
                  <th className="p-4">Assigned Category</th>
                  <th className="p-4">Created Date</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 text-sm font-semibold text-gray-900">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-md font-mono text-xs text-gray-700">
                        {rule.keyword}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      <span className="bg-[#6558D3]/10 text-[#6558D3] px-3 py-1 rounded-full text-xs font-semibold">
                        {rule.category}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(rule.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="text-xs text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2.5 py-1 rounded-md transition cursor-pointer font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddRuleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        onSuccess={fetchRules}
        initialData={editingRule}
      />
    </div>
  );
}
