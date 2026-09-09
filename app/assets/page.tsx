"use client";

import { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import AddAssetModal, { AssetFormData } from "../components/AddAssetModal";
import { useCurrency } from "../context/CurrencyContext";

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  category: string;
  invested_amount: number | string;
  current_value: number | string;
  quantity: number | string;
  unit: string;
  monthly_contribution: number | string;
  institution: string;
  notes: string;
  created_at: string;
}

const ASSET_TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bgBadge: string }
> = {
  mutual_fund: {
    label: "Mutual Funds & SIP",
    icon: "📈",
    color: "#6558D3",
    bgBadge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  equity: {
    label: "Stocks & Equity",
    icon: "📊",
    color: "#3B82F6",
    bgBadge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  precious_metal: {
    label: "Gold & Silver",
    icon: "🪙",
    color: "#F59E0B",
    bgBadge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  crypto: {
    label: "Cryptocurrency",
    icon: "⚡",
    color: "#10B981",
    bgBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  fixed_income: {
    label: "Fixed Income & Bonds",
    icon: "🏦",
    color: "#06B6D4",
    bgBadge: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  retirement: {
    label: "Retirement (EPF/PPF)",
    icon: "🛡️",
    color: "#8B5CF6",
    bgBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  real_estate: {
    label: "Real Estate & Land",
    icon: "🏡",
    color: "#EC4899",
    bgBadge: "bg-pink-50 text-pink-700 border-pink-200",
  },
  other: {
    label: "Other Assets",
    icon: "💼",
    color: "#6B7280",
    bgBadge: "bg-gray-50 text-gray-700 border-gray-200",
  },
};

export default function AssetsPage() {
  const { formatCurrency } = useCurrency();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetFormData | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssets = () => {
    setIsLoading(true);
    fetch("/api/assets")
      .then((res) => res.json())
      .then((data) => {
        if (data.assets && Array.isArray(data.assets)) {
          setAssets(data.assets);
        } else if (Array.isArray(data)) {
          setAssets(data);
        }
      })
      .catch((err) => console.error("Failed to load assets:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // Summary Metrics
  const totalInvested = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.invested_amount) || 0), 0);
  }, [assets]);

  const totalCurrentValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);
  }, [assets]);

  const totalMonthlyContribution = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.monthly_contribution) || 0), 0);
  }, [assets]);

  const totalGainLoss = totalCurrentValue - totalInvested;
  const totalGainLossPercentage =
    totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchesType = filterType === "all" || a.asset_type === filterType;
      const matchesSearch =
        (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (a.institution || "").toLowerCase().includes(search.toLowerCase()) ||
        (a.notes || "").toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [assets, filterType, search]);

  // Allocation Data for Donut Chart
  const allocationData = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => {
      const type = a.asset_type || "other";
      const config = ASSET_TYPE_CONFIG[type] || ASSET_TYPE_CONFIG.other;
      const label = config.label;
      map[label] = (map[label] || 0) + (Number(a.current_value) || 0);
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));
  }, [assets]);

  const handleOpenAdd = () => {
    setEditingAsset(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: Asset) => {
    setEditingAsset({
      id: a.id,
      name: a.name,
      asset_type: a.asset_type,
      category: a.category,
      invested_amount: a.invested_amount,
      current_value: a.current_value,
      quantity: a.quantity,
      unit: a.unit,
      monthly_contribution: a.monthly_contribution,
      institution: a.institution,
      notes: a.notes,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this asset from your portfolio?")) return;
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error("Delete asset error:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assets & Portfolio</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track mutual funds, SIPs, stocks, gold, silver, crypto, and your monthly investment growth.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-sm cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>+</span> Add Asset / SIP
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Portfolio Value</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">
              {formatCurrency(totalCurrentValue)}
            </p>
          </div>
          <p className="text-xs text-[#6558D3] font-medium mt-3">
            {assets.length} Active Holding{assets.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* Invested Capital */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Invested Capital</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">
              {formatCurrency(totalInvested)}
            </p>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-3">Total principal deployed</p>
        </div>

        {/* Monthly SIP & Inflow */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Monthly SIP & Inflows</p>
            <p className="text-2xl lg:text-3xl font-bold text-emerald-600 mt-2">
              {formatCurrency(totalMonthlyContribution)}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-3">
            Monthly recurring wealth allocation
          </p>
        </div>

        {/* Total Unrealized Gain / Loss */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Returns</p>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  totalGainLoss >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {totalGainLossPercentage >= 0 ? "+" : ""}
                {totalGainLossPercentage.toFixed(1)}%
              </span>
            </div>
            <p
              className={`text-2xl lg:text-3xl font-bold mt-2 ${
                totalGainLoss >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {totalGainLoss >= 0 ? "+" : ""}
              {formatCurrency(totalGainLoss)}
            </p>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-3">Unrealized market gains</p>
        </div>
      </div>

      {/* Asset Allocation Chart & Highlights */}
      {assets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Allocation Donut Chart */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Asset Allocation</h3>
              <p className="text-xs text-gray-400 mt-0.5">Holdings distribution by class</p>
            </div>

            <div className="h-64 w-full flex items-center justify-center my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {allocationData.map((entry, idx) => {
                      const colors = ["#6558D3", "#3B82F6", "#F59E0B", "#10B981", "#06B6D4", "#EC4899", "#8B5CF6", "#6B7280"];
                      return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{ backgroundColor: "#1F2937", borderRadius: "12px", border: "none", color: "#FFF", fontSize: "12px" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Category Cards Breakdown */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Asset Class Breakdown</h3>
              <p className="text-xs text-gray-400 mb-4">Invested capital and recurring SIP rates</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(ASSET_TYPE_CONFIG).map(([typeKey, cfg]) => {
                const groupAssets = assets.filter((a) => a.asset_type === typeKey);
                if (groupAssets.length === 0) return null;
                const groupVal = groupAssets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);
                const groupSip = groupAssets.reduce((sum, a) => sum + (Number(a.monthly_contribution) || 0), 0);
                const pct = totalCurrentValue > 0 ? ((groupVal / totalCurrentValue) * 100).toFixed(0) : "0";

                return (
                  <div key={typeKey} className="p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{cfg.icon}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
                        {pct}%
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 truncate">{cfg.label.split(" ")[0]}</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(groupVal)}</p>
                    {groupSip > 0 && (
                      <p className="text-[10px] text-emerald-600 font-semibold truncate">
                        +{formatCurrency(groupSip)}/mo SIP
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-400">Total Monthly Wealth Allocation:</span>
              <span className="font-bold text-emerald-600">+{formatCurrency(totalMonthlyContribution)}/mo</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Search assets, SIPs, gold, crypto, or broker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30"
        />

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "mutual_fund", label: "Mutual Funds" },
            { id: "equity", label: "Stocks" },
            { id: "precious_metal", label: "Gold & Silver" },
            { id: "crypto", label: "Crypto" },
            { id: "fixed_income", label: "Fixed Income" },
            { id: "retirement", label: "Retirement" },
            { id: "real_estate", label: "Real Estate" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition cursor-pointer ${
                filterType === tab.id
                  ? "bg-[#6558D3] text-white shadow-2xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading portfolio...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No assets found. Click &quot;+ Add Asset / SIP&quot; to track mutual funds, gold, crypto, or shares!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="p-4">Asset / Holding</th>
                  <th className="p-4">Asset Class</th>
                  <th className="p-4 text-right">Invested</th>
                  <th className="p-4 text-right">Current Value</th>
                  <th className="p-4 text-right">Returns (P&L)</th>
                  <th className="p-4 text-center">Monthly SIP</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAssets.map((asset) => {
                  const invested = Number(asset.invested_amount) || 0;
                  const current = Number(asset.current_value) || invested;
                  const gain = current - invested;
                  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
                  const monthlySip = Number(asset.monthly_contribution) || 0;
                  const cfg = ASSET_TYPE_CONFIG[asset.asset_type] || ASSET_TYPE_CONFIG.other;

                  return (
                    <tr key={asset.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{cfg.icon}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{asset.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {asset.institution || "Personal Holding"}
                              {Number(asset.quantity) > 0 ? ` • ${asset.quantity} ${asset.unit || "units"}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-xs font-semibold">
                        <span className={`px-2.5 py-1 rounded-full border ${cfg.bgBadge}`}>
                          {cfg.label}
                        </span>
                      </td>

                      <td className="p-4 text-sm font-medium text-gray-600 text-right whitespace-nowrap">
                        {formatCurrency(invested)}
                      </td>

                      <td className="p-4 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                        {formatCurrency(current)}
                      </td>

                      <td className="p-4 text-right whitespace-nowrap">
                        <p className={`text-sm font-bold ${gain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {gain >= 0 ? "+" : ""}
                          {formatCurrency(gain)}
                        </p>
                        <p className={`text-[10px] font-semibold ${gain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {gainPct >= 0 ? "+" : ""}
                          {gainPct.toFixed(1)}%
                        </p>
                      </td>

                      <td className="p-4 text-center whitespace-nowrap">
                        {monthlySip > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                            {formatCurrency(monthlySip)}/mo
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(asset)}
                          className="text-xs text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2 py-1 rounded-md transition cursor-pointer font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id)}
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

      <AddAssetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAsset(null);
        }}
        onSuccess={fetchAssets}
        initialData={editingAsset}
      />
    </div>
  );
}
