"use client";

import React, { useState } from "react";

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword: (password: string) => void;
}

export function generateStrongPassword(
  length: number = 16,
  options = { upper: true, lower: true, numbers: true, symbols: true }
): string {
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWER = "abcdefghijkmnopqrstuvwxyz";
  const NUMBERS = "23456789";
  const SYMBOLS = "!@#$%^&*()_+-=[]{};:,.<>?";

  let charset = "";
  const guaranteed: string[] = [];

  if (options.upper) {
    charset += UPPER;
    guaranteed.push(UPPER[Math.floor(Math.random() * UPPER.length)]);
  }
  if (options.lower) {
    charset += LOWER;
    guaranteed.push(LOWER[Math.floor(Math.random() * LOWER.length)]);
  }
  if (options.numbers) {
    charset += NUMBERS;
    guaranteed.push(NUMBERS[Math.floor(Math.random() * NUMBERS.length)]);
  }
  if (options.symbols) {
    charset += SYMBOLS;
    guaranteed.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }

  if (!charset) charset = LOWER + NUMBERS;

  const remainingLength = Math.max(0, length - guaranteed.length);
  const result: string[] = [...guaranteed];

  for (let i = 0; i < remainingLength; i++) {
    result.push(charset[Math.floor(Math.random() * charset.length)]);
  }

  // Shuffle array securely
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}

export default function PasswordGeneratorModal({
  isOpen,
  onClose,
  onSelectPassword,
}: PasswordGeneratorModalProps) {
  const [length, setLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeLower, setIncludeLower] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generated, setGenerated] = useState(() => generateStrongPassword(16));
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const pwd = generateStrongPassword(length, {
      upper: includeUpper,
      lower: includeLower,
      numbers: includeNumbers,
      symbols: includeSymbols,
    });
    setGenerated(pwd);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onSelectPassword(generated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Complex Password Generator</h3>
            <p className="text-xs text-gray-400 mt-0.5">Generate standard-compliant cryptographically secure keys</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">
            ✕
          </button>
        </div>

        {/* Password Display Box */}
        <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 flex items-center justify-between gap-2 mb-5">
          <span className="font-mono text-base font-bold text-purple-950 tracking-wider break-all select-all">
            {generated}
          </span>
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="p-2 rounded-xl bg-white hover:bg-purple-100 border border-purple-200 text-xs font-semibold text-[#6558D3] transition shrink-0 cursor-pointer"
          >
            {copied ? "Copied!" : "📋 Copy"}
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-semibold text-gray-700">Length: {length} characters</span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Standard: 10+
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={32}
              value={length}
              onChange={(e) => {
                const newLen = Number(e.target.value);
                setLength(newLen);
                setGenerated(generateStrongPassword(newLen, {
                  upper: includeUpper,
                  lower: includeLower,
                  numbers: includeNumbers,
                  symbols: includeSymbols,
                }));
              }}
              className="w-full accent-[#6558D3] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input
                type="checkbox"
                checked={includeUpper}
                onChange={(e) => setIncludeUpper(e.target.checked)}
                className="rounded text-[#6558D3] focus:ring-[#6558D3]"
              />
              <span>Uppercase (A-Z)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input
                type="checkbox"
                checked={includeLower}
                onChange={(e) => setIncludeLower(e.target.checked)}
                className="rounded text-[#6558D3] focus:ring-[#6558D3]"
              />
              <span>Lowercase (a-z)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
                className="rounded text-[#6558D3] focus:ring-[#6558D3]"
              />
              <span>Numbers (0-9)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
                className="rounded text-[#6558D3] focus:ring-[#6558D3]"
              />
              <span>Symbols (!@#$%)</span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center gap-2 pt-6 mt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleGenerate}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
          >
            🔄 Regenerate
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-gray-500 hover:text-gray-700 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-[#6558D3] hover:bg-[#5244bd] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              Use This Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
