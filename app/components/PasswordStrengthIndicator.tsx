"use client";

import React from "react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\|,.<>\/?~`]/.test(password);

  const passedCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  const getStrengthLabel = () => {
    if (password.length === 0) return { label: "", color: "bg-gray-200", textColor: "text-gray-400" };
    if (passedCount <= 2) return { label: "Weak", color: "bg-rose-500", textColor: "text-rose-600" };
    if (passedCount === 3 || passedCount === 4) return { label: "Moderate", color: "bg-amber-500", textColor: "text-amber-600" };
    return { label: "Strong & Standard Compliant", color: "bg-emerald-500", textColor: "text-emerald-600" };
  };

  const { label, color, textColor } = getStrengthLabel();

  return (
    <div className="space-y-3 pt-1">
      {/* Strength Progress Bar */}
      {password.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Password Strength</span>
            <span className={`font-bold ${textColor}`}>{label}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`rounded-full transition-all duration-200 ${
                  passedCount >= step ? color : "bg-gray-100"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rules Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-700" : "text-gray-400"}`}>
          <span>{hasMinLength ? "✓" : "○"}</span>
          <span>At least 10 characters</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-emerald-700" : "text-gray-400"}`}>
          <span>{hasUppercase ? "✓" : "○"}</span>
          <span>Uppercase letter (A-Z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasLowercase ? "text-emerald-700" : "text-gray-400"}`}>
          <span>{hasLowercase ? "✓" : "○"}</span>
          <span>Lowercase letter (a-z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-700" : "text-gray-400"}`}>
          <span>{hasNumber ? "✓" : "○"}</span>
          <span>Numeric digit (0-9)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-emerald-700" : "text-gray-400"}`}>
          <span>{hasSpecial ? "✓" : "○"}</span>
          <span>Special character (!@#$%)</span>
        </div>
      </div>
    </div>
  );
}
