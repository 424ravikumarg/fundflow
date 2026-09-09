"use client";

import React, { useState, useEffect } from "react";
import PasswordGeneratorModal from "./PasswordGeneratorModal";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";

export interface CredentialFormData {
  id?: string;
  title: string;
  username: string;
  password?: string;
  url?: string;
  category: string;
  notes?: string;
}

interface AddCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: CredentialFormData | null;
}

const CATEGORIES = [
  "Banking & Finance",
  "Work & Cloud",
  "Email & Comms",
  "Shopping & Subscriptions",
  "Personal & Govt",
  "General",
];

export default function AddCredentialModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AddCredentialModalProps) {
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Banking & Finance");
  const [notes, setNotes] = useState("");
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setUsername(initialData.username || "");
      setPassword(""); // For edit, user leaves blank if keeping current encrypted password
      setUrl(initialData.url || "");
      setCategory(initialData.category || "Banking & Finance");
      setNotes(initialData.notes || "");
    } else {
      setTitle("");
      setUsername("");
      setPassword("");
      setUrl("");
      setCategory("Banking & Finance");
      setNotes("");
    }
    setErrorMsg(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || !username.trim()) {
      setErrorMsg("Title and username/email are required.");
      return;
    }

    if (!initialData && !password.trim()) {
      setErrorMsg("Password is required for new credentials.");
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = Boolean(initialData?.id);
      const urlEndpoint = "/api/credentials";
      const method = isEdit ? "PATCH" : "POST";

      const payload: any = {
        title: title.trim(),
        username: username.trim(),
        url: url.trim(),
        category,
        notes: notes.trim(),
      };

      if (isEdit) {
        payload.id = initialData!.id;
        if (password.trim()) payload.password = password.trim();
      } else {
        payload.password = password.trim();
      }

      const res = await fetch(urlEndpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to save credential.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {initialData ? "Edit Stored Credential" : "Store Encrypted Credential"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Passwords are encrypted at rest using bank-grade AES-256-GCM.
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">
              ✕
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Account Title / Service *</label>
              <input
                type="text"
                required
                placeholder="e.g. AWS Management Console, GitHub, HDFC NetBanking"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Username / Email *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin@company.com or john_dev"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 outline-none bg-white focus:ring-2 focus:ring-[#6558D3]/30"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Password input with generator button */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-gray-700">
                  {initialData ? "New Password (Leave blank to keep existing)" : "Password *"}
                </label>
                <button
                  type="button"
                  onClick={() => setIsGeneratorOpen(true)}
                  className="text-[11px] font-bold text-[#6558D3] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  ⚡ Generate Complex Password
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required={!initialData}
                  placeholder={initialData ? "••••••••••••" : "Enter or generate a complex password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 pr-20 font-mono rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-gray-400 hover:text-gray-700 text-xs font-semibold cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {password.length > 0 && <PasswordStrengthIndicator password={password} />}
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Website / Login URL (Optional)</label>
              <input
                type="text"
                placeholder="https://console.aws.amazon.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Secure Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Account PIN, security questions, or backup codes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Encrypting & Storing..." : initialData ? "Save Changes" : "Save Encrypted"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSelectPassword={(pwd) => {
          setPassword(pwd);
          setShowPassword(true);
        }}
      />
    </>
  );
}
