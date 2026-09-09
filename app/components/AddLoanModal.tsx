"use client";

import { useState, useEffect } from "react";

export interface LoanFormData {
  id?: string;
  name: string;
  type: "borrowed" | "lent";
  lender: string;
  principal_amount: number | string;
  remaining_amount: number | string;
  interest_rate: number | string;
  monthly_emi: number | string;
  start_date: string;
  end_date: string | null;
  status?: "active" | "paid_off" | "defaulted";
}

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: LoanFormData | null;
}

function formatDateForInput(dateVal?: string | null) {
  if (!dateVal) return "";
  if (dateVal.includes("T")) return dateVal.split("T")[0];
  if (dateVal.length >= 10) return dateVal.substring(0, 10);
  return dateVal;
}

export default function AddLoanModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddLoanModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"borrowed" | "lent">("borrowed");
  const [lender, setLender] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [monthlyEmi, setMonthlyEmi] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"active" | "paid_off" | "defaulted">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setType(initialData.type || "borrowed");
      setLender(initialData.lender || "");
      setPrincipalAmount(String(initialData.principal_amount || ""));
      setRemainingAmount(String(initialData.remaining_amount || ""));
      setInterestRate(String(initialData.interest_rate || ""));
      setMonthlyEmi(String(initialData.monthly_emi || ""));
      setStartDate(formatDateForInput(initialData.start_date) || new Date().toISOString().split("T")[0]);
      setEndDate(formatDateForInput(initialData.end_date));
      setStatus(initialData.status || "active");
    } else {
      setName("");
      setType("borrowed");
      setLender("");
      setPrincipalAmount("");
      setRemainingAmount("");
      setInterestRate("");
      setMonthlyEmi("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setStatus("active");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

  const handlePrincipalChange = (val: string) => {
    setPrincipalAmount(val);
    if (!isEditing && (!remainingAmount || remainingAmount === principalAmount)) {
      setRemainingAmount(val);
    }
  };

  const calculateSuggestedEmi = () => {
    const P = parseFloat(principalAmount);
    const r = parseFloat(interestRate) / (12 * 100);
    const sDate = new Date(startDate);
    const eDate = endDate ? new Date(endDate) : null;

    if (!isNaN(P) && P > 0 && eDate && eDate > sDate) {
      const months = Math.max(
        1,
        (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth())
      );

      if (r > 0) {
        const emi = (P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
        setMonthlyEmi(emi.toFixed(2));
      } else {
        setMonthlyEmi((P / months).toFixed(2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/loans";
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload = isEditing
        ? {
            id: initialData!.id,
            name,
            type,
            lender: lender || (type === "borrowed" ? "Bank / Lender" : "Recipient"),
            principal_amount: parseFloat(principalAmount),
            remaining_amount: parseFloat(remainingAmount || principalAmount),
            interest_rate: parseFloat(interestRate) || 0,
            monthly_emi: parseFloat(monthlyEmi) || 0,
            start_date: startDate,
            end_date: endDate || null,
            status,
          }
        : {
            name,
            type,
            lender: lender || (type === "borrowed" ? "Bank / Lender" : "Recipient"),
            principal_amount: parseFloat(principalAmount),
            remaining_amount: parseFloat(remainingAmount || principalAmount),
            interest_rate: parseFloat(interestRate) || 0,
            monthly_emi: parseFloat(monthlyEmi) || 0,
            start_date: startDate,
            end_date: endDate || null,
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
        alert(errJson.error || (isEditing ? "Failed to update loan" : "Failed to save loan"));
      }
    } catch (err) {
      console.error("Error saving loan:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {isEditing ? "Edit Loan / Debt Tracker" : "Add Loan / Debt Tracker"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Track mortgages, auto loans, personal debt, or money lent to others
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Loan Direction: Borrowed vs Lent */}
          <div className="flex gap-4 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
            <button
              type="button"
              onClick={() => setType("borrowed")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                type === "borrowed"
                  ? "bg-[#6558D3] text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Borrowed (I owe debt)
            </button>
            <button
              type="button"
              onClick={() => setType("lent")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                type === "lent"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Lent Out (Owed to me)
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Loan / Purpose Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Home Mortgage, Car Loan, Friend Loan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          {/* Lender / Counterparty */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              {type === "borrowed" ? "Lender / Bank Institution" : "Recipient / Borrower Name"}
            </label>
            <input
              type="text"
              placeholder={type === "borrowed" ? "e.g. Chase, HDFC, SBI, Toyota Financial" : "e.g. Alex, John"}
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
            />
          </div>

          {/* Principal & Remaining Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Principal Amount
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="25000.00"
                value={principalAmount}
                onChange={(e) => handlePrincipalChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Current Outstanding Balance
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="21500.00"
                value={remainingAmount}
                onChange={(e) => setRemainingAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
          </div>

          {/* Interest Rate & Monthly EMI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Interest Rate (% p.a.)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 6.5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Monthly Payment (EMI)
                </label>
                {endDate && (
                  <button
                    type="button"
                    onClick={calculateSuggestedEmi}
                    className="text-[10px] text-[#6558D3] font-bold hover:underline cursor-pointer"
                  >
                    ⚡ Calculate
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="450.00"
                value={monthlyEmi}
                onChange={(e) => setMonthlyEmi(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Target Payoff Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              />
            </div>
          </div>

          {/* Status if editing */}
          {isEditing && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-[#6558D3]/30 focus:border-[#6558D3]"
              >
                <option value="active">Active (Ongoing)</option>
                <option value="paid_off">Paid Off (Completed)</option>
                <option value="defaulted">Defaulted</option>
              </select>
            </div>
          )}

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
              {isSubmitting ? "Saving..." : isEditing ? "Update Loan" : "Save Loan Tracker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
