"use client";

import React, { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { useRouter } from "next/navigation";

interface PhoneAuthProps {
  onSuccess?: () => void;
}

export default function PhoneAuthModal({ onSuccess }: PhoneAuthProps) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    // Initialize invisible reCAPTCHA on mount
    if (!recaptchaVerifierRef.current && typeof window !== "undefined") {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            // reCAPTCHA solved
          },
        });
      } catch (e) {
        console.error("reCAPTCHA init error:", e);
      }
    }

    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Send SMS OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        phoneNumber.trim(),
        recaptchaVerifierRef.current
      );
      setConfirmationResult(confirmation);
    } catch (err: any) {
      console.error("SMS dispatch error:", err);
      setErrorMsg(err.message || "Failed to send SMS OTP. Check phone number format.");
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || otpCode.length !== 6) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      // 1. Confirm OTP on client with Firebase
      const credential = await confirmationResult.confirm(otpCode.trim());
      const idToken = await credential.user.getIdToken();

      // 2. Exchange Firebase ID Token with your Next.js Backend
      const res = await fetch("/api/auth/phone-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setErrorMsg(err.message || "Invalid OTP code entered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm max-w-md w-full mx-auto space-y-4">
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>

      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900">Mobile Number Verification</h3>
        <p className="text-xs text-gray-500 mt-1">
          {!confirmationResult
            ? "Enter your mobile number with country code to receive an OTP."
            : `Enter the 6-digit verification code sent to ${phoneNumber}.`}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {!confirmationResult ? (
        <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Mobile Number</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30 text-sm font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || phoneNumber.length < 10}
            className="w-full py-3 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? "Sending SMS..." : "Send OTP via SMS"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-gray-700 block mb-1 text-center">
              Enter 6-Digit Verification Code
            </label>
            <input
              type="text"
              maxLength={6}
              autoFocus
              required
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-3 font-mono text-center text-2xl tracking-widest font-bold rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full py-3 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & Log In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmationResult(null);
              setOtpCode("");
            }}
            className="w-full text-center text-gray-500 hover:text-gray-700 text-xs font-semibold py-1 cursor-pointer"
          >
            ← Change Phone Number
          </button>
        </form>
      )}
    </div>
  );
}
