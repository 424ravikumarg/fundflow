"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorDetails([]);

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(name.trim(), email.trim(), phone.trim(), password);
      if (res.error) {
        setErrorMsg(res.error);
        if (res.details) setErrorDetails(res.details);
      } else {
        router.push("/");
      }
    } finally {
      setIsSubmitting(false);
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
        <h2 className="text-xl font-bold text-gray-900">Create your Fundflow account</h2>
        <p className="text-xs text-gray-500 mt-1">
          Every user creates a secure account with complex password standards and encrypted credentials.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl shadow-sm border border-gray-100">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
              {errorDetails.length > 0 && (
                <ul className="list-disc list-inside text-[11px] pl-2 space-y-0.5 text-rose-600">
                  {errorDetails.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="Ravi Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Email Address *</label>
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
                <label className="font-semibold text-gray-700 block mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Password *</label>
              <input
                type="password"
                required
                placeholder="Must meet standard complex format"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm font-mono"
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Confirm Password *</label>
              <input
                type="password"
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm font-mono"
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <span className="text-[11px] text-rose-600 block mt-1">Passwords do not match.</span>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </button>
            </div>

            <div className="text-center pt-3 border-t border-gray-100 text-xs text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-[#6558D3] font-bold hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
