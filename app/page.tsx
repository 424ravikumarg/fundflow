"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import AddEntryModal from "./components/AddEntryModal";
import { useCurrency } from "./context/CurrencyContext";

interface Transaction {
  id: string;
  amount: number | string;
  merchant: string;
  category: string;
  date: string;
  type: "income" | "expense";
}

interface Subscription {
  id: string;
  name: string;
  amount: number | string;
  billing_cycle: "monthly" | "yearly";
  category: string;
  next_billing_date: string;
  status: string;
}

interface Loan {
  id: string;
  name: string;
  type: "borrowed" | "lent";
  lender: string;
  principal_amount: number | string;
  remaining_amount: number | string;
  interest_rate: number | string;
  monthly_emi: number | string;
  start_date: string;
  end_date: string | null;
  status: "active" | "paid_off" | "defaulted";
}

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  category?: string;
  invested_amount: number | string;
  current_value: number | string;
  monthly_contribution: number | string;
  institution?: string;
}

const DONUT_COLORS = [
  "#6558D3",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
];

export default function DashboardPage() {
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [baselineNetWorth, setBaselineNetWorth] = useState(0);
  const [timeframe, setTimeframe] = useState<"this_month" | "last_month" | "all_time" | "this_year">("this_month");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const fetchDashboardData = () => {
    fetch("/api/transactions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .catch((err) => console.error("Failed to load transactions", err));

    fetch("/api/subscriptions")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSubscriptions(data);
      })
      .catch((err) => console.error("Failed to load subscriptions", err));

    fetch("/api/loans")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLoans(data);
      })
      .catch((err) => console.error("Failed to load loans", err));

    fetch("/api/assets")
      .then((res) => res.json())
      .then((data) => {
        if (data.assets && Array.isArray(data.assets)) {
          setAssets(data.assets);
        } else if (Array.isArray(data)) {
          setAssets(data);
        }
      })
      .catch((err) => console.error("Failed to load assets", err));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.baseline_net_worth !== undefined) {
          setBaselineNetWorth(Number(data.settings.baseline_net_worth) || 0);
        }
      })
      .catch((err) => console.error("Failed to load settings", err));
  };

  useEffect(() => {
    setIsMounted(true);
    fetchDashboardData();
  }, []);

  // 1. Monthly Fixed Obligations (Active Subscriptions + Active Loan EMIs)
  const totalMonthlySubscriptions = useMemo(() => {
    return subscriptions
      .filter((s) => s.status === "active" || !s.status)
      .reduce((sum, s) => {
        const cost = Number(s.amount) || 0;
        return sum + (s.billing_cycle === "yearly" ? cost / 12 : cost);
      }, 0);
  }, [subscriptions]);

  const totalMonthlyLoanEmis = useMemo(() => {
    return loans
      .filter((l) => l.type === "borrowed" && l.status === "active")
      .reduce((sum, l) => sum + (Number(l.monthly_emi) || 0), 0);
  }, [loans]);

  const totalMonthlyFixedObligations = totalMonthlySubscriptions + totalMonthlyLoanEmis;

  // 2. Loan Liabilities & Receivables
  const totalBorrowedDebt = useMemo(() => {
    return loans
      .filter((l) => l.type === "borrowed" && l.status === "active")
      .reduce((sum, l) => sum + (Number(l.remaining_amount) || 0), 0);
  }, [loans]);

  const totalLentReceivables = useMemo(() => {
    return loans
      .filter((l) => l.type === "lent" && l.status === "active")
      .reduce((sum, l) => sum + (Number(l.remaining_amount) || 0), 0);
  }, [loans]);

  // 3. Asset Portfolio Totals
  const totalAssetsValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0);
  }, [assets]);

  const totalMonthlySip = useMemo(() => {
    return assets.reduce((sum, a) => sum + (Number(a.monthly_contribution) || 0), 0);
  }, [assets]);

  // 4. Timeframe Date Filtering for Transactions
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return false;

      if (timeframe === "this_month") {
        return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
      }
      if (timeframe === "last_month") {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        return (
          tDate.getFullYear() === lastMonthDate.getFullYear() &&
          tDate.getMonth() === lastMonthDate.getMonth()
        );
      }
      if (timeframe === "this_year") {
        return tDate.getFullYear() === currentYear;
      }
      return true; // "all_time"
    });
  }, [transactions, timeframe, currentYear, currentMonth]);

  // 5. Timeframe Spending & Income Calculations
  const timeframeOneTimeExpenses = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const timeframeIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Timeframe Outflows (one-time expenses + recurring obligations)
  const timeframeMonthsMultiplier = timeframe === "this_year" ? (currentMonth + 1) : 1;
  const timeframeSpending = timeframeOneTimeExpenses + (totalMonthlyFixedObligations * timeframeMonthsMultiplier);

  // Savings rate for selected timeframe
  const savingsRate =
    timeframeIncome > 0
      ? Math.max(0, Math.round(((timeframeIncome - timeframeSpending) / timeframeIncome) * 100))
      : 0;

  // 6. True All-Time Net Worth (Assets + Cash/Inflows - Liabilities/Debts)
  const allTimeIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const allTimeExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const netWorth = baselineNetWorth + totalAssetsValue + allTimeIncome + totalLentReceivables - allTimeExpenses - totalBorrowedDebt;

  // Days remaining helper
  const getDaysUntil = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 7. Cash Flow Area Chart Data (Dynamically responds to timeframe)
  const { chartData: cashFlowData, chartSubtitle } = useMemo<{
    chartData: { month: string; income: number; spending: number }[];
    chartSubtitle: string;
  }>(() => {
    if (timeframe === "this_month" || timeframe === "last_month") {
      const isThisMonth = timeframe === "this_month";
      const targetYear = isThisMonth ? currentYear : (currentMonth === 0 ? currentYear - 1 : currentYear);
      const targetMonth = isThisMonth ? currentMonth : (currentMonth === 0 ? 11 : currentMonth - 1);

      const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const monthShort = new Date(targetYear, targetMonth, 1).toLocaleDateString("en-US", { month: "short" });
      const monthFull = new Date(targetYear, targetMonth, 1).toLocaleDateString("en-US", { month: "long" });

      const dayMap: { [key: string]: { label: string; income: number; spending: number } } = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayLabel = `${day} ${monthShort}`;
        dayMap[dateStr] = { label: dayLabel, income: 0, spending: 0 };
      }

      transactions.forEach((t) => {
        const tDate = t.date ? t.date.split("T")[0] : "";
        if (dayMap[tDate]) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") {
            dayMap[tDate].income += amt;
          } else {
            dayMap[tDate].spending += amt;
          }
        }
      });

      const dailyData = Object.keys(dayMap).map((k) => ({
        month: dayMap[k].label,
        income: Number(dayMap[k].income.toFixed(2)),
        spending: Number(dayMap[k].spending.toFixed(2)),
      }));

      return {
        chartData: dailyData,
        chartSubtitle: `Daily Income vs. Spending for ${monthFull} ${targetYear}`,
      };
    }

    if (timeframe === "this_year") {
      const yearMap: { [key: string]: { label: string; income: number; spending: number } } = {};

      for (let m = 0; m < 12; m++) {
        const d = new Date(currentYear, m, 1);
        const label = d.toLocaleDateString("en-US", { month: "short" });
        const monthKey = `${currentYear}-${String(m + 1).padStart(2, "0")}`;
        yearMap[monthKey] = {
          label,
          income: 0,
          spending: m <= currentMonth ? totalMonthlyFixedObligations : 0,
        };
      }

      transactions.forEach((t) => {
        const tDate = new Date(t.date);
        if (isNaN(tDate.getTime())) return;
        if (tDate.getFullYear() !== currentYear) return;
        const monthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, "0")}`;

        if (yearMap[monthKey]) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") {
            yearMap[monthKey].income += amt;
          } else {
            yearMap[monthKey].spending += amt;
          }
        }
      });

      const yearData = Object.keys(yearMap).map((k) => ({
        month: yearMap[k].label,
        income: Number(yearMap[k].income.toFixed(2)),
        spending: Number(yearMap[k].spending.toFixed(2)),
      }));

      return {
        chartData: yearData,
        chartSubtitle: `Monthly Income vs. Outflow for ${currentYear}`,
      };
    }

    // "all_time": Chronological monthly trend across all historical activity
    const monthsMap: { [key: string]: { label: string; income: number; spending: number } } = {};

    let startD = new Date(currentYear, currentMonth - 5, 1);
    let endD = new Date(currentYear, currentMonth, 1);

    if (transactions.length > 0) {
      const validDates = transactions
        .map((t) => new Date(t.date).getTime())
        .filter((ts) => !isNaN(ts));
      if (validDates.length > 0) {
        const minDate = new Date(Math.min(...validDates));
        startD = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      }
    }

    const curr = new Date(startD);
    let count = 0;
    while (curr <= endD || count < 6) {
      const label = curr.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const monthKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;

      monthsMap[monthKey] = {
        label,
        income: 0,
        spending: totalMonthlyFixedObligations,
      };

      curr.setMonth(curr.getMonth() + 1);
      count++;
    }

    transactions.forEach((t) => {
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime())) return;
      const monthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, "0")}`;

      if (monthsMap[monthKey]) {
        const amt = Number(t.amount) || 0;
        if (t.type === "income") {
          monthsMap[monthKey].income += amt;
        } else {
          monthsMap[monthKey].spending += amt;
        }
      }
    });

    const monthsData = Object.keys(monthsMap).map((k) => ({
      month: monthsMap[k].label,
      income: Number(monthsMap[k].income.toFixed(2)),
      spending: Number(monthsMap[k].spending.toFixed(2)),
    }));

    return {
      chartData: monthsData,
      chartSubtitle: "All-Time Monthly Income vs. Outflow (Expenses + Subscriptions + Loan EMIs)",
    };
  }, [transactions, timeframe, currentYear, currentMonth, totalMonthlyFixedObligations]);

  // 8. Category Breakdown Data (For selected timeframe)
  const categoryBreakdownData = useMemo(() => {
    const map: { [key: string]: number } = {};

    filteredTransactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const cat = t.category || "General";
        map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
      });

    if (totalMonthlySubscriptions > 0) {
      map["Subscriptions"] = (map["Subscriptions"] || 0) + totalMonthlySubscriptions;
    }

    if (totalMonthlyLoanEmis > 0) {
      map["Loan EMIs"] = (map["Loan EMIs"] || 0) + totalMonthlyLoanEmis;
    }

    return Object.entries(map).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));
  }, [filteredTransactions, totalMonthlySubscriptions, totalMonthlyLoanEmis]);

  return (
    <div className="space-y-8">
      {/* Header with Timeframe Filter & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time overview of monthly cash flow, category breakdowns, loans & debt, and commitments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Selector Pill */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-gray-200 shadow-2xs">
            {[
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "this_year", label: "This Year" },
              { id: "all_time", label: "All Time" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeframe(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  timeframe === tab.id
                    ? "bg-[#6558D3] text-white shadow-2xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link
            href="/assets"
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-2xl text-xs font-semibold transition shadow-2xs flex items-center gap-1.5"
          >
            <span>📈</span> Assets & SIP
          </Link>
          <Link
            href="/loans"
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-2xl text-xs font-semibold transition shadow-2xs flex items-center gap-1.5"
          >
            <span>🏦</span> Loans
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-4 py-2 rounded-2xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            + Add entry
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid (5-column layout on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Net Worth (Incorporating Assets) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Net Worth</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">{formatCurrency(netWorth)}</p>
          </div>
          <p className="text-xs text-[#6558D3] font-medium mt-3">Assets + Cash − Debts</p>
        </div>

        {/* Inflows for Timeframe */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {timeframe === "this_month" ? "This Month's Inflows" : "Selected Inflows"}
            </p>
            <p className="text-2xl lg:text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(timeframeIncome)}</p>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-3">Income & deposits</p>
        </div>

        {/* Spending for Timeframe */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {timeframe === "this_month" ? "This Month's Spending" : "Selected Spending"}
            </p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">{formatCurrency(timeframeSpending)}</p>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-3">
            {formatCurrency(timeframeOneTimeExpenses)} one-time + {formatCurrency(totalMonthlyFixedObligations)} fixed
          </p>
        </div>

        {/* Loan Liabilities */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Loan Liabilities</p>
              <Link href="/loans" className="text-[10px] text-[#6558D3] font-bold hover:underline">
                View →
              </Link>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-rose-600 mt-2">{formatCurrency(totalBorrowedDebt)}</p>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-3">
            {totalMonthlyLoanEmis > 0 ? `${formatCurrency(totalMonthlyLoanEmis)}/mo EMI` : "No active debt"}
          </p>
        </div>

        {/* Savings Rate */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Savings Rate</p>
            <p className="text-2xl lg:text-3xl font-bold text-[#6558D3] mt-2">{savingsRate}%</p>
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-3">
            {timeframeIncome > timeframeSpending
              ? `+${formatCurrency(timeframeIncome - timeframeSpending)} retained`
              : `${formatCurrency(timeframeIncome - timeframeSpending)} net`}
          </p>
        </div>
      </div>

      {/* Visual Analytics Row */}
      {isMounted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Flow Area Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">Cash Flow Trends</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {chartSubtitle}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Income
                </span>
                <span className="flex items-center gap-1.5 text-[#6558D3]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6558D3]"></span> Spending
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              {cashFlowData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No transaction data available for charting.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6558D3" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6558D3" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={20} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip
                      formatter={(val: any) => formatCurrency(Number(val))}
                      contentStyle={{ backgroundColor: "#1F2937", borderRadius: "12px", border: "none", color: "#FFF", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#incomeGrad)" />
                    <Area type="monotone" dataKey="spending" stroke="#6558D3" strokeWidth={2.5} fillOpacity={1} fill="url(#spendGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Category Donut Chart */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Expenses by Category</h3>
              <p className="text-xs text-gray-400 mt-0.5">For {timeframe.replace("_", " ")}</p>
            </div>

            <div className="h-64 w-full flex items-center justify-center my-auto">
              {categoryBreakdownData.length === 0 ? (
                <p className="text-xs text-gray-400">No expense records found.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryBreakdownData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => formatCurrency(Number(val))}
                      contentStyle={{ backgroundColor: "#1F2937", borderRadius: "12px", border: "none", color: "#FFF", fontSize: "12px" }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row: Recent Transactions, Upcoming Bills, Active Loans & Assets Portfolio */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Recent Transactions Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900">Recent Transactions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Latest account activity</p>
              </div>
              <Link href="/transactions" className="text-xs font-semibold text-[#6558D3] hover:underline">
                View all →
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-xs">
                No transactions found. Click &quot;+ Add entry&quot; to log your first transaction!
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.slice(0, 4).map((txn) => (
                  <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{txn.merchant}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(txn.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} • {txn.category}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        txn.type === "expense" ? "text-gray-900" : "text-emerald-600"
                      }`}
                    >
                      {txn.type === "expense" ? "-" : "+"}
                      {formatCurrency(Number(txn.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-xs flex justify-between">
            <span className="text-gray-500">Total Entries:</span>
            <span className="font-semibold text-gray-900">{transactions.length}</span>
          </div>
        </div>

        {/* Upcoming Bills Box */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Upcoming Bills</h3>
                <p className="text-xs text-gray-400 mt-0.5">Recurring commitments</p>
              </div>
              <Link href="/recurring" className="text-xs font-semibold text-[#6558D3] hover:underline">
                Manage →
              </Link>
            </div>

            {subscriptions.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No active subscriptions.
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.slice(0, 3).map((sub) => {
                  const daysLeft = getDaysUntil(sub.next_billing_date);

                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 border border-gray-100"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-900">{sub.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(sub.next_billing_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(Number(sub.amount))}
                          <span className="text-[10px] text-gray-400 font-normal">
                            /{sub.billing_cycle === "yearly" ? "yr" : "mo"}
                          </span>
                        </p>
                        <span
                          className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                            daysLeft <= 3
                              ? "bg-red-100 text-red-700"
                              : daysLeft <= 7
                              ? "bg-amber-100 text-amber-700"
                              : "bg-[#6558D3]/15 text-[#6558D3]"
                          }`}
                        >
                          {daysLeft === 0
                            ? "Due today"
                            : daysLeft < 0
                            ? "Past due"
                            : `Due in ${daysLeft}d`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center text-xs">
            <span className="text-gray-400">Total Subscriptions:</span>
            <span className="font-bold text-gray-900">{formatCurrency(totalMonthlySubscriptions)}/mo</span>
          </div>
        </div>

        {/* Active Loans & Debt Summary Box */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Loans & Debt</h3>
                <p className="text-xs text-gray-400 mt-0.5">Active debt servicing</p>
              </div>
              <Link href="/loans" className="text-xs font-semibold text-[#6558D3] hover:underline">
                View all →
              </Link>
            </div>

            {loans.filter((l) => l.status === "active").length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No active loans or debts logged. Click &quot;Manage Loans&quot; to add one!
              </div>
            ) : (
              <div className="space-y-3">
                {loans
                  .filter((l) => l.status === "active")
                  .slice(0, 3)
                  .map((loan) => {
                    const principal = Number(loan.principal_amount);
                    const remaining = Number(loan.remaining_amount);
                    const percentPaid = principal > 0 ? Math.min(100, Math.round(((principal - remaining) / principal) * 100)) : 0;

                    return (
                      <div
                        key={loan.id}
                        className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{loan.name}</p>
                            <p className="text-xs text-gray-400">{loan.lender}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-rose-600">
                              {formatCurrency(remaining)}
                            </span>
                            <span className="text-[10px] text-gray-400 block">
                              {percentPaid}% repaid
                            </span>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6558D3] rounded-full"
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center text-xs">
            <span className="text-gray-400">Total Outstanding Debt:</span>
            <span className="font-bold text-rose-600">{formatCurrency(totalBorrowedDebt)}</span>
          </div>
        </div>

        {/* Assets & Portfolio Summary Box */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Assets & SIPs</h3>
                <p className="text-xs text-gray-400 mt-0.5">Wealth & investments</p>
              </div>
              <Link href="/assets" className="text-xs font-semibold text-[#6558D3] hover:underline">
                View all →
              </Link>
            </div>

            {assets.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No investment holdings tracked. Click &quot;Assets & SIP&quot; above to track mutual funds, gold, crypto, or shares!
              </div>
            ) : (
              <div className="space-y-3">
                {assets.slice(0, 3).map((a) => {
                  const invested = Number(a.invested_amount) || 0;
                  const current = Number(a.current_value) || invested;
                  const gain = current - invested;
                  const monthlySip = Number(a.monthly_contribution) || 0;

                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-gray-900 truncate max-w-[130px]">{a.name}</p>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(current)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-400">{a.institution || "Holding"}</span>
                        {monthlySip > 0 ? (
                          <span className="text-emerald-600 font-semibold">+{formatCurrency(monthlySip)}/mo SIP</span>
                        ) : (
                          <span className={gain >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            {gain >= 0 ? "+" : ""}{formatCurrency(gain)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between items-center text-xs">
            <span className="text-gray-400">Total Portfolio Value:</span>
            <span className="font-bold text-[#6558D3]">{formatCurrency(totalAssetsValue)}</span>
          </div>
        </div>
      </div>

      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchDashboardData();
        }}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}
