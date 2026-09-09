"use client";

import { useState, useEffect, useMemo } from "react";
import AddLoanModal, { LoanFormData } from "../components/AddLoanModal";
import { useCurrency } from "../context/CurrencyContext";

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
  created_at: string;
}

export default function LoansPage() {
  const { formatCurrency } = useCurrency();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanFormData | null>(null);
  const [filterType, setFilterType] = useState<"all" | "borrowed" | "lent" | "paid_off">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentLoanId, setPaymentLoanId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const fetchLoans = async () => {
    try {
      const res = await fetch("/api/loans");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLoans(data);
      }
    } catch (err) {
      console.error("Failed to load loans:", err);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleOpenAdd = () => {
    setEditingLoan(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (l: Loan) => {
    setEditingLoan({
      id: l.id,
      name: l.name,
      type: l.type,
      lender: l.lender,
      principal_amount: l.principal_amount,
      remaining_amount: l.remaining_amount,
      interest_rate: l.interest_rate,
      monthly_emi: l.monthly_emi,
      start_date: l.start_date,
      end_date: l.end_date,
      status: l.status,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this loan tracker?")) return;
    try {
      const res = await fetch(`/api/loans?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setLoans((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (err) {
      console.error("Delete loan error:", err);
    }
  };

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentLoanId || isNaN(parseFloat(paymentAmount))) return;

    try {
      const res = await fetch("/api/loans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentLoanId,
          payment_made: parseFloat(paymentAmount),
        }),
      });

      if (res.ok) {
        setPaymentLoanId(null);
        setPaymentAmount("");
        fetchLoans();
      }
    } catch (err) {
      console.error("Payment error:", err);
    }
  };

  // Metrics Calculations
  const totalBorrowedDebt = useMemo(() => {
    return loans
      .filter((l) => l.type === "borrowed" && l.status === "active")
      .reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  }, [loans]);

  const totalLentReceivables = useMemo(() => {
    return loans
      .filter((l) => l.type === "lent" && l.status === "active")
      .reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  }, [loans]);

  const totalMonthlyEmi = useMemo(() => {
    return loans
      .filter((l) => l.type === "borrowed" && l.status === "active")
      .reduce((sum, l) => sum + Number(l.monthly_emi), 0);
  }, [loans]);

  const totalPrincipalBorrowed = useMemo(() => {
    return loans
      .filter((l) => l.type === "borrowed")
      .reduce((sum, l) => sum + Number(l.principal_amount), 0);
  }, [loans]);

  const totalRepaidAmount = Math.max(0, totalPrincipalBorrowed - totalBorrowedDebt);
  const overallRepaidPercent =
    totalPrincipalBorrowed > 0 ? Math.round((totalRepaidAmount / totalPrincipalBorrowed) * 100) : 0;

  // Filtered List
  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const matchSearch =
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.lender.toLowerCase().includes(searchQuery.toLowerCase());

      let matchFilter = true;
      if (filterType === "borrowed") matchFilter = l.type === "borrowed" && l.status === "active";
      else if (filterType === "lent") matchFilter = l.type === "lent" && l.status === "active";
      else if (filterType === "paid_off") matchFilter = l.status === "paid_off";

      return matchSearch && matchFilter;
    });
  }, [loans, searchQuery, filterType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Loans & Debt Trackers</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track mortgages, auto financing, student debt, personal loans, and money lent to others.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          + Add loan
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Outstanding Debt</p>
          <p className="text-2xl font-bold mt-1 text-rose-600">{formatCurrency(totalBorrowedDebt)}</p>
          <p className="text-xs text-gray-400 mt-1">Across active liabilities</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Monthly EMI Outflow</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{formatCurrency(totalMonthlyEmi)}</p>
          <p className="text-xs text-gray-400 mt-1">Fixed loan servicing/month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Lent Out / Receivables</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(totalLentReceivables)}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Owed to you</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Debt Payoff Progress</p>
          <p className="text-2xl font-bold mt-1 text-[#6558D3]">{overallRepaidPercent}%</p>
          <p className="text-xs text-gray-400 mt-1">{formatCurrency(totalRepaidAmount)} repaid so far</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <input
            type="text"
            placeholder="Search loans, lenders, or borrowers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "all", label: `All (${loans.length})` },
            { id: "borrowed", label: `Borrowed Debt (${loans.filter((l) => l.type === "borrowed" && l.status === "active").length})` },
            { id: "lent", label: `Lent Out (${loans.filter((l) => l.type === "lent" && l.status === "active").length})` },
            { id: "paid_off", label: "Paid Off 🎉" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition cursor-pointer ${
                filterType === tab.id
                  ? "bg-[#6558D3] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredLoans.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center text-gray-400 text-sm">
            No loan or debt trackers found. Click &quot;+ Add loan&quot; above to create one!
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const principal = Number(loan.principal_amount);
            const remaining = Number(loan.remaining_amount);
            const paidAmount = Math.max(0, principal - remaining);
            const percentPaid = principal > 0 ? Math.min(100, Math.round((paidAmount / principal) * 100)) : 0;
            const isPaidOff = loan.status === "paid_off" || remaining === 0;

            return (
              <div
                key={loan.id}
                className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{loan.type === "borrowed" ? "🏦" : "🤝"}</span>
                        <h3 className="text-base font-bold text-gray-900">{loan.name}</h3>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {loan.type === "borrowed" ? `Lender: ${loan.lender}` : `Borrower: ${loan.lender}`}
                        {Number(loan.interest_rate) > 0 && ` • ${loan.interest_rate}% p.a.`}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isPaidOff
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : loan.type === "borrowed"
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : "bg-purple-50 text-[#6558D3] border border-purple-200"
                      }`}
                    >
                      {isPaidOff
                        ? "Paid Off 🎉"
                        : loan.type === "borrowed"
                        ? "Liability (I Owe)"
                        : "Receivable (Owed to Me)"}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline my-3">
                    <div>
                      <span className="text-xs text-gray-400 uppercase font-semibold block">Outstanding</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 uppercase font-semibold block">Principal</span>
                      <span className="text-sm font-semibold text-gray-600">
                        {formatCurrency(principal)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                      <span>Repaid: {formatCurrency(paidAmount)}</span>
                      <span>{percentPaid}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPaidOff
                            ? "bg-emerald-500"
                            : loan.type === "borrowed"
                            ? "bg-[#6558D3]"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Details & Actions */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap justify-between items-center text-xs gap-2">
                  <div className="text-gray-500">
                    {Number(loan.monthly_emi) > 0 && (
                      <span className="font-semibold text-gray-800 mr-2">
                        EMI: {formatCurrency(Number(loan.monthly_emi))}/mo
                      </span>
                    )}
                    {loan.end_date && (
                      <span>
                        Target: {new Date(loan.end_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(loan)}
                      className="text-xs text-[#6558D3] hover:text-[#5244bd] hover:bg-purple-50 px-2.5 py-1.5 rounded-xl font-semibold transition cursor-pointer"
                    >
                      Edit
                    </button>
                    {!isPaidOff && (
                      <button
                        onClick={() => {
                          setPaymentLoanId(loan.id);
                          setPaymentAmount(loan.monthly_emi ? String(loan.monthly_emi) : "500");
                        }}
                        className="bg-[#6558D3]/10 hover:bg-[#6558D3]/20 text-[#6558D3] px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer"
                      >
                        + Log Payment
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-gray-400 hover:text-rose-600 font-medium px-2 py-1 transition cursor-pointer"
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

      {/* Log Payment Modal */}
      {paymentLoanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Log Loan Payment</h3>
            <p className="text-xs text-gray-400 mb-4">
              Enter the amount paid to reduce the remaining principal balance.
            </p>

            <form onSubmit={handleMakePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Payment Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentLoanId(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Loan Modal */}
      <AddLoanModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLoan(null);
        }}
        onSuccess={fetchLoans}
        initialData={editingLoan}
      />
    </div>
  );
}
