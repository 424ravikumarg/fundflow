"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "../context/CurrencyContext";

export interface AssetFormData {
  id?: string;
  name: string;
  asset_type: string;
  category?: string;
  invested_amount: number | string;
  current_value: number | string;
  quantity?: number | string;
  unit?: string;
  monthly_contribution?: number | string;
  institution?: string;
  notes?: string;
}

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: AssetFormData | null;
}

const ASSET_TYPES = [
  { id: "mutual_fund", label: "Mutual Funds & SIPs", icon: "📈", defaultUnit: "units" },
  { id: "equity", label: "Stocks & Equity Shares", icon: "📊", defaultUnit: "shares" },
  { id: "precious_metal", label: "Precious Metals (Gold & Silver)", icon: "🪙", defaultUnit: "grams" },
  { id: "crypto", label: "Cryptocurrency", icon: "⚡", defaultUnit: "coins" },
  { id: "fixed_income", label: "Fixed Income, FDs & Bonds", icon: "🏦", defaultUnit: "deposits" },
  { id: "retirement", label: "Retirement (EPF / PPF / NPS)", icon: "🛡️", defaultUnit: "units" },
  { id: "real_estate", label: "Real Estate & Land", icon: "🏡", defaultUnit: "sq.ft" },
  { id: "other", label: "Other Assets & Valuables", icon: "💼", defaultUnit: "units" },
];

export default function AddAssetModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddAssetModalProps) {
  const { symbol } = useCurrency();
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("mutual_fund");
  const [investedAmount, setInvestedAmount] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("units");
  const [institution, setInstitution] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setAssetType(initialData.asset_type || "mutual_fund");
      setInvestedAmount(String(initialData.invested_amount ?? ""));
      setCurrentValue(String(initialData.current_value ?? ""));
      setMonthlyContribution(String(initialData.monthly_contribution ?? ""));
      setQuantity(String(initialData.quantity ?? ""));
      setUnit(initialData.unit || "units");
      setInstitution(initialData.institution || "");
      setNotes(initialData.notes || "");
    } else {
      setName("");
      setAssetType("mutual_fund");
      setInvestedAmount("");
      setCurrentValue("");
      setMonthlyContribution("");
      setQuantity("");
      setUnit("units");
      setInstitution("");
      setNotes("");
    }
    setErrorMsg(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleAssetTypeChange = (typeId: string) => {
    setAssetType(typeId);
    const found = ASSET_TYPES.find((t) => t.id === typeId);
    if (found && !initialData) {
      setUnit(found.defaultUnit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Asset name is required.");
      return;
    }

    const invested = parseFloat(investedAmount) || 0;
    const current = parseFloat(currentValue) || invested;

    if (invested < 0 || current < 0) {
      setErrorMsg("Values cannot be negative.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      id: initialData?.id,
      name: name.trim(),
      asset_type: assetType,
      invested_amount: invested,
      current_value: current,
      monthly_contribution: parseFloat(monthlyContribution) || 0,
      quantity: parseFloat(quantity) || 0,
      unit: unit.trim() || "units",
      institution: institution.trim(),
      notes: notes.trim(),
    };

    try {
      const isEditing = Boolean(initialData?.id);
      const res = await fetch("/api/assets", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save asset");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Save Asset Error:", err);
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {initialData ? "Edit Asset / Investment" : "Add Asset / Investment"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Track mutual funds, SIPs, stocks, gold, crypto, and fixed assets.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-medium p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Asset Class Grid */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1.5">Asset Class / Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ASSET_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handleAssetTypeChange(t.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer ${
                    assetType === t.id
                      ? "border-[#6558D3] bg-purple-50/60 text-[#6558D3] font-bold shadow-2xs"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg mb-1">{t.icon}</span>
                  <span className="text-[10px] leading-tight line-clamp-1">{t.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Asset Name */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Asset / Holding Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Nifty 50 Index Fund, Physical Gold 24K, Bitcoin, Reliance Shares"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
            />
          </div>

          {/* Valuation Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Total Invested Capital ({symbol}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 50000"
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Current Market Value ({symbol})
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Leave blank to match invested"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
              />
            </div>
          </div>

          {/* Monthly SIP Contribution & Platform */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Monthly SIP / Inflow ({symbol}/mo)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5000 (if recurring SIP)"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Broker / Institution / Platform</label>
              <input
                type="text"
                placeholder="e.g. Zerodha, Groww, Tanishq, SBI, Coin"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
              />
            </div>
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Quantity (Optional)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 10.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Unit Label</label>
              <input
                type="text"
                placeholder="e.g. units, shares, grams, BTC"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Notes / Folio / Account Ref</label>
            <input
              type="text"
              placeholder="e.g. Folio 123456, Locker #12, SGB 2026 Series I"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#6558D3] focus:ring-1 focus:ring-[#6558D3]"
            />
          </div>

          {/* Action Buttons */}
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
              className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2 rounded-xl text-sm font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : initialData ? "Update Asset" : "Add to Portfolio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
