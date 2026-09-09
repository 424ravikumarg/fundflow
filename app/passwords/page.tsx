"use client";

import React, { useState, useEffect, useMemo } from "react";
import AddCredentialModal, { CredentialFormData } from "../components/AddCredentialModal";
import PasswordGeneratorModal from "../components/PasswordGeneratorModal";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";

interface CredentialItem {
  id: string;
  title: string;
  username: string;
  url: string | null;
  category: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function PasswordManagerPage() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CredentialFormData | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  // Decrypted passwords cache: { [credentialId]: { password: string, revealedUntil: number } }
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: string }>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      const res = await fetch("/api/credentials");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCredentials(data);
      }
    } catch (err) {
      console.error("Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleReveal = async (id: string) => {
    if (revealedPasswords[id]) {
      // Hide immediately
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setRevealingId(id);
    try {
      const res = await fetch(`/api/credentials/${id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.password) {
        setRevealedPasswords((prev) => ({ ...prev, [id]: data.password }));

        // Auto-mask after 15 seconds for privacy
        setTimeout(() => {
          setRevealedPasswords((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 15000);
      } else {
        alert(data.error || "Unable to decrypt password.");
      }
    } catch (err) {
      alert("Error decrypting credential.");
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (id: string) => {
    let pwd = revealedPasswords[id];
    if (!pwd) {
      // Fetch and copy on the fly
      try {
        const res = await fetch(`/api/credentials/${id}/reveal`, { method: "POST" });
        const data = await res.json();
        if (res.ok && data.password) {
          pwd = data.password;
        }
      } catch (err) {
        return;
      }
    }

    if (pwd) {
      navigator.clipboard.writeText(pwd);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete stored credential "${title}"?`)) return;
    try {
      const res = await fetch(`/api/credentials?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filtered = useMemo(() => {
    return credentials.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.username.toLowerCase().includes(search.toLowerCase()) ||
        (c.url || "").toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [credentials, search, categoryFilter]);

  const categories = Array.from(new Set(credentials.map((c) => c.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">User Password Manager</h2>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              AES-256-GCM Encrypted
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Store, generate, and manage your account credentials with bank-grade authenticated encryption.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsGeneratorOpen(true)}
            className="border border-purple-200 bg-purple-50 hover:bg-purple-100 text-[#6558D3] px-4 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <span>⚡</span> Complex Key Generator
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            className="bg-[#6558D3] hover:bg-[#5244bd] text-white px-5 py-2 rounded-2xl text-xs font-semibold transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span> Store New Credential
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Total Vault Items</span>
          <p className="mt-2 text-2xl font-bold text-gray-900">{credentials.length}</p>
          <p className="text-[11px] text-gray-400 mt-1">Stored encrypted passwords</p>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Banking & Finance</span>
          <p className="mt-2 text-2xl font-bold text-[#6558D3]">
            {credentials.filter((c) => c.category === "Banking & Finance").length}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">High-security accounts</p>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Work & Cloud</span>
          <p className="mt-2 text-2xl font-bold text-indigo-600">
            {credentials.filter((c) => c.category === "Work & Cloud").length}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Developer & corporate keys</p>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold uppercase text-gray-400">Security Standard</span>
          <p className="mt-2 text-2xl font-bold text-emerald-600">256-Bit</p>
          <p className="text-[11px] text-emerald-700 mt-1">Zero-knowledge GCM cipher</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Search stored accounts, username, or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 border border-gray-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-[#6558D3]/30"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition cursor-pointer ${
              categoryFilter === "all"
                ? "bg-[#6558D3] text-white shadow-2xs font-semibold"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({credentials.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition cursor-pointer whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-[#6558D3] text-white shadow-2xs font-semibold"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Vault Grid */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center text-xs text-gray-400">
          Loading secure vault credentials...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-100 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#6558D3] flex items-center justify-center mx-auto text-xl font-bold">
            🔒
          </div>
          <h3 className="text-base font-bold text-gray-900">No Credentials Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {search
              ? "No stored credentials match your search query."
              : "Your password vault is currently empty. Store account logins securely with AES-256 encryption."}
          </p>
          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-[#6558D3] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            + Store First Credential
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isRevealed = Boolean(revealedPasswords[item.id]);
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{item.title}</h4>
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                        {item.category}
                      </span>
                    </div>
                    {item.url && (
                      <a
                        href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-[#6558D3] text-xs p-1.5 rounded-lg hover:bg-purple-50 transition"
                        title="Open login URL"
                      >
                        ↗
                      </a>
                    )}
                  </div>

                  {/* Username / Account */}
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 space-y-2 text-xs mt-3">
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="text-[11px] font-medium text-gray-400">Username / Email:</span>
                      <span className="font-mono text-gray-900 font-semibold select-all break-all text-right">
                        {item.username}
                      </span>
                    </div>

                    {/* Password Row */}
                    <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                      <span className="text-[11px] font-medium text-gray-400">Password:</span>
                      <span className="font-mono font-bold text-gray-900 select-all tracking-wider">
                        {isRevealed ? revealedPasswords[item.id] : "••••••••••••••••"}
                      </span>
                    </div>
                  </div>

                  {/* Notes Preview */}
                  {item.notes && (
                    <p className="text-[11px] text-gray-400 italic mt-2.5 line-clamp-2">
                      &ldquo;{item.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleReveal(item.id)}
                      disabled={revealingId === item.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#6558D3] hover:bg-purple-50 transition cursor-pointer"
                    >
                      {revealingId === item.id ? "Decrypting..." : isRevealed ? "Hide" : "👁️ Reveal"}
                    </button>
                    <button
                      onClick={() => handleCopy(item.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                    >
                      {isCopied ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingItem({
                          id: item.id,
                          title: item.title,
                          username: item.username,
                          url: item.url || "",
                          category: item.category,
                          notes: item.notes || "",
                        });
                        setIsAddModalOpen(true);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                      title="Edit Credential"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="text-xs text-rose-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Delete Credential"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AddCredentialModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSuccess={fetchCredentials}
        initialData={editingItem}
      />

      {/* Complex Key Generator Modal */}
      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSelectPassword={(pwd) => {
          navigator.clipboard.writeText(pwd);
          alert("Generated password copied to clipboard!");
        }}
      />
    </div>
  );
}
