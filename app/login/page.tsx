"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, verify2FA, requestOtp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2FA Flow
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [twoFactorData, setTwoFactorData] = useState<{
    userId: string;
    method: "email" | "mobile";
    maskedDestination: string;
    message: string;
    debugOtp?: string;
  } | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.requires2FA && res.userId) {
        setIs2FAStep(true);
        setTwoFactorData({
          userId: res.userId,
          method: res.method || "email",
          maskedDestination: res.maskedDestination || email,
          message: res.message || "Please enter the verification code.",
          debugOtp: res.debugOtp,
        });
      } else {
        router.push("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorData || !otpCode) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await verify2FA(twoFactorData.userId, otpCode.trim(), "login_2fa");
      if (res.success) {
        router.push("/");
      } else {
        setErrorMsg(res.error || "Invalid verification code.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!twoFactorData) return;
    setResendStatus("Dispatching new code...");
    const res = await requestOtp(twoFactorData.userId, "login_2fa", twoFactorData.method);
    if (res.success) {
      setResendStatus("New code dispatched!");
      if (res.debugOtp) {
        setTwoFactorData((prev) => (prev ? { ...prev, debugOtp: res.debugOtp } : null));
      }
      setTimeout(() => setResendStatus(null), 3000);
    } else {
      setResendStatus(res.error || "Failed to resend code");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-[#6558D3] flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-[#6558D3]/20">
            F
          </div>
          <span className="text-2xl font-extrabold text-[#6558D3] tracking-tight">Fundflow</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900">
          {is2FAStep ? "Two-Factor Verification" : "Sign in to your account"}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {is2FAStep
            ? `Enter the 6-digit OTP sent to ${twoFactorData?.maskedDestination}`
            : "Access your financial dashboard and encrypted password vault"}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-sm border border-gray-100">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {!is2FAStep ? (
            /* Step 1: Email & Password Form */
            <form onSubmit={handleSubmitLogin} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Authenticating..." : "Sign In"}
                </button>
              </div>

              <div className="text-center pt-3 border-t border-gray-100 text-xs text-gray-500">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-[#6558D3] font-bold hover:underline">
                  Create Account
                </Link>
              </div>
            </form>
          ) : (
            /* Step 2: Two-Factor OTP Verification Form */
            <form onSubmit={handleVerify2FA} className="space-y-4 text-xs">
              <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-100 text-purple-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <span>🛡️</span>
                  <span>2FA Security Verification Required</span>
                </div>
                <p className="text-[11px] text-purple-800">
                  {twoFactorData?.message || `A verification code was sent to ${twoFactorData?.maskedDestination}.`}
                </p>
                {twoFactorData?.debugOtp && (
                  <div className="pt-2 flex items-center justify-between text-[11px] font-mono font-bold text-[#6558D3]">
                    <span>Demo Test OTP: {twoFactorData.debugOtp}</span>
                    <button
                      type="button"
                      onClick={() => setOtpCode(twoFactorData.debugOtp || "")}
                      className="underline font-sans cursor-pointer text-xs"
                    >
                      Autofill
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1 text-center">
                  Enter 6-Digit One-Time Password (OTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-3 font-mono text-center text-2xl tracking-widest font-bold rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-[#6558D3] font-bold hover:underline cursor-pointer"
                >
                  Resend Code
                </button>
                {resendStatus && <span className="text-emerald-600 font-medium">{resendStatus}</span>}
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length !== 6}
                  className="w-full py-3 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Verifying OTP..." : "Verify & Enter Fundflow"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIs2FAStep(false);
                    setOtpCode("");
                  }}
                  className="w-full py-2 text-gray-500 hover:text-gray-700 text-xs font-semibold cursor-pointer"
                >
                  ← Back to Email & Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
