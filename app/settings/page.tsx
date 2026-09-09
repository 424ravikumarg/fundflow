"use client";

import { useState, useEffect, useRef } from "react";
import { useCurrency } from "../context/CurrencyContext";

interface HealthStatus {
  rds: { status: string; service: string; database: string };
  s3: { status: string; service: string; bucket: string; region: string };
  local?: { status: string; service: string; path: string };
}

export default function SettingsPage() {
  const { currency, setCurrency, formatCurrency, supportedCurrencies } = useCurrency();
  const [baselineNetWorth, setBaselineNetWorth] = useState("0");
  const [storageDestination, setStorageDestination] = useState<"local" | "s3">("local");
  const [localStoragePath, setLocalStoragePath] = useState("./storage/documents");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);
  const [isSavingStorage, setIsSavingStorage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currencySaveSuccess, setCurrencySaveSuccess] = useState(false);
  const [storageSaveSuccess, setStorageSaveSuccess] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettingsAndHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setBaselineNetWorth(String(data.settings?.baseline_net_worth || 0));
        if (data.settings?.storage_destination) {
          setStorageDestination(data.settings.storage_destination as any);
        }
        if (data.settings?.local_storage_path) {
          setLocalStoragePath(data.settings.local_storage_path);
        }
        setHealth(data.health);
      }
    } catch (err) {
      console.error("Failed to load settings & health", err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndHealth();
  }, []);

  const handleSaveBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBaseline(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseline_net_worth: parseFloat(baselineNetWorth) || 0 }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Failed to save baseline net worth.");
      }
    } catch (err) {
      console.error("Save baseline error:", err);
    } finally {
      setIsSavingBaseline(false);
    }
  };

  const handleCurrencyChange = async (newCode: string) => {
    await setCurrency(newCode);
    setCurrencySaveSuccess(true);
    setTimeout(() => setCurrencySaveSuccess(false), 3000);
  };

  const handleStorageDestinationChange = async (newDest: "local" | "s3") => {
    setStorageDestination(newDest);
    setIsSavingStorage(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage_destination: newDest }),
      });

      if (res.ok) {
        setStorageSaveSuccess(true);
        setTimeout(() => setStorageSaveSuccess(false), 3000);
        fetchSettingsAndHealth();
      } else {
        alert("Failed to update storage destination.");
      }
    } catch (err) {
      console.error("Storage change error:", err);
    } finally {
      setIsSavingStorage(false);
    }
  };

  const downloadCSV = (type: "transactions" | "subscriptions" | "budgets") => {
    window.open(`/api/export?type=${type}`, "_blank");
  };

  const downloadFullBackup = () => {
    window.open("/api/backup", "_blank");
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to restore data from "${file.name}"? Existing entries will be preserved and missing records will be inserted.`)) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsRestoring(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert(
          `Backup successfully restored!
` +
          `• Transactions: ${data.restoredCounts?.transactions || 0}
` +
          `• Subscriptions: ${data.restoredCounts?.subscriptions || 0}
` +
          `• Budgets: ${data.restoredCounts?.budgets || 0}
` +
          `• Loans: ${data.restoredCounts?.loans || 0}
` +
          `• Goals: ${data.restoredCounts?.goals || 0}`
        );
      } else {
        alert(`Restore failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Restore error:", err);
      alert("Network error occurred during backup restoration.");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings & Preferences</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure storage destination (Local vs S3), display currency, starting baseline balances, and backups.
        </p>
      </div>

      {/* 1. Storage Destination: Local Storage vs AWS S3 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-gray-900">Data & Document Storage Destination</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose where your financial statements, uploads, and document vault files are stored.
            </p>
          </div>
          {storageSaveSuccess && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full font-semibold border border-emerald-200 animate-in fade-in">
              ✓ Storage set to {storageDestination === "local" ? "Local On-Device" : "AWS S3 Cloud"}!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Option A: Local Storage */}
          <button
            type="button"
            onClick={() => handleStorageDestinationChange("local")}
            disabled={isSavingStorage}
            className={`p-5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              storageDestination === "local"
                ? "border-[#6558D3] bg-[#6558D3]/5 shadow-xs ring-2 ring-[#6558D3]/20"
                : "border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 hover:border-gray-300"
            }`}
          >
            <div>
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📁</span>
                  <span className="text-base font-bold text-gray-900">Local Storage</span>
                </div>
                {storageDestination === "local" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6558D3] text-white">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">
                Stores all statement uploads and document vault files locally on your device filesystem. Zero cloud dependency or storage costs.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 font-mono">{localStoragePath}</span>
              <span
                className={`font-semibold ${
                  health?.local?.status === "connected" ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                ● {health?.local?.status === "connected" ? "Operational" : "Offline"}
              </span>
            </div>
          </button>

          {/* Option B: AWS S3 Storage */}
          <button
            type="button"
            onClick={() => handleStorageDestinationChange("s3")}
            disabled={isSavingStorage}
            className={`p-5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              storageDestination === "s3"
                ? "border-[#6558D3] bg-[#6558D3]/5 shadow-xs ring-2 ring-[#6558D3]/20"
                : "border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 hover:border-gray-300"
            }`}
          >
            <div>
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">☁️</span>
                  <span className="text-base font-bold text-gray-900">AWS S3 Cloud Vault</span>
                </div>
                {storageDestination === "s3" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6558D3] text-white">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-2.5 leading-relaxed">
                Stores statement documents and attachments in your encrypted AWS S3 bucket for multi-device cloud accessibility.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 font-mono">
                {health?.s3.bucket || "ledgerly-vault"} ({health?.s3.region || "ap-south-1"})
              </span>
              <span
                className={`font-semibold ${
                  health?.s3.status === "connected" ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                ● {health?.s3.status === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Global Currency Selection */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-gray-900">Display Currency & Symbol</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose the currency symbol to display across all transactions, budgets, subscriptions, and charts.
            </p>
          </div>
          {currencySaveSuccess && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full font-semibold border border-emerald-200 animate-in fade-in">
              ✓ Currency updated!
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
          {supportedCurrencies.map((c) => {
            const isSelected = currency.toUpperCase() === c.code.toUpperCase();
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCurrencyChange(c.code)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "border-[#6558D3] bg-[#6558D3]/5 shadow-xs ring-2 ring-[#6558D3]/20"
                    : "border-gray-200 bg-gray-50/50 hover:bg-gray-100/80 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className={`text-lg font-bold ${isSelected ? "text-[#6558D3]" : "text-gray-900"}`}>
                    {c.symbol}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-bold">
                    {c.code}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2 truncate font-medium">{c.name}</p>
              </button>
            );
          })}
        </div>

        {/* Currency Preview Bar */}
        <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-600">
          <span>Active formatting preview:</span>
          <div className="flex items-center gap-3 font-semibold">
            <span className="text-emerald-600">+{formatCurrency(1250.5)}</span>
            <span className="text-gray-900">-{formatCurrency(45.99)}</span>
          </div>
        </div>
      </div>

      {/* 3. Infrastructure Diagnostics */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900">Storage & Infrastructure Health</h3>
            <p className="text-xs text-gray-400 mt-0.5">Live connectivity status for database and storage backends</p>
          </div>
          <button
            onClick={fetchSettingsAndHealth}
            disabled={isLoadingHealth}
            className="text-xs font-semibold text-[#6558D3] hover:underline flex items-center gap-1 cursor-pointer"
          >
            🔄 {isLoadingHealth ? "Checking..." : "Re-check"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* RDS Health */}
          <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">
                🐘
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{health?.rds.service || "RDS PostgreSQL"}</p>
                <p className="text-xs text-gray-400">DB: {health?.rds.database || "ledgerly"}</p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                health?.rds.status === "connected"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              ● {health?.rds.status === "connected" ? "Connected" : "Error"}
            </span>
          </div>

          {/* Local Storage Health */}
          <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg">
                📁
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Local Filesystem</p>
                <p className="text-xs text-gray-400">Path: ./storage</p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                health?.local?.status === "connected"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              ● {health?.local?.status === "connected" ? "Ready" : "Error"}
            </span>
          </div>

          {/* S3 Health */}
          <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg">
                ☁️
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{health?.s3.service || "AWS S3 Bucket"}</p>
                <p className="text-xs text-gray-400">Bucket: {health?.s3.bucket || "ledgerly-vault"}</p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                health?.s3.status === "connected"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-gray-100 text-gray-500 border border-gray-200"
              }`}
            >
              ● {health?.s3.status === "connected" ? "Available" : "Optional"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Baseline Net Worth Configuration */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Baseline Starting Balance</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Set an existing starting balance (savings, external brokerage, real estate) to offset overall Net Worth.
          </p>
        </div>

        <form onSubmit={handleSaveBaseline} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-4 top-2.5 text-gray-400 text-sm font-bold">
              {supportedCurrencies.find((c) => c.code === currency)?.symbol || "$"}
            </span>
            <input
              type="number"
              step="0.01"
              value={baselineNetWorth}
              onChange={(e) => setBaselineNetWorth(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              placeholder="0.00"
            />
          </div>
          <button
            type="submit"
            disabled={isSavingBaseline}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSavingBaseline ? "Saving..." : "Update Baseline"}
          </button>
          {saveSuccess && <span className="text-xs text-emerald-600 font-semibold">✓ Saved successfully!</span>}
        </form>
      </div>

      {/* 5. Complete Database Backup & Restore */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Data Backup & Restore</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Export a full JSON backup of all your transactions, budgets, subscriptions, loans, and settings, or restore from a backup.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={downloadFullBackup}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-3 rounded-2xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>💾</span> Export Complete Backup (JSON)
          </button>

          <label className="border border-gray-200 bg-gray-50/70 hover:bg-gray-100 text-gray-700 px-5 py-3 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2">
            <span>📤</span> {isRestoring ? "Restoring Data..." : "Restore From Backup (JSON)"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileRestore}
              disabled={isRestoring}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 6. CSV Data Export */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Export Financial Ledgers (CSV)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Download individual financial records into standard spreadsheets.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => downloadCSV("transactions")}
            className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/80 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">Transactions</p>
              <p className="text-xs text-gray-400">All income & expenses</p>
            </div>
            <span className="text-base">📥</span>
          </button>

          <button
            onClick={() => downloadCSV("subscriptions")}
            className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/80 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">Subscriptions</p>
              <p className="text-xs text-gray-400">Recurring bills & cycles</p>
            </div>
            <span className="text-base">📥</span>
          </button>

          <button
            onClick={() => downloadCSV("budgets")}
            className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/80 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">Budgets</p>
              <p className="text-xs text-gray-400">Category limits & caps</p>
            </div>
            <span className="text-base">📥</span>
          </button>
        </div>
      </div>
    </div>
  );
}
