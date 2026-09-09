"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";
import { useRouter } from "next/navigation";

export default function AccountMaintenancePage() {
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();

  // Profile Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 2FA Form
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "mobile">("email");
  const [isUpdating2FA, setIsUpdating2FA] = useState(false);
  const [otpVerifyOpen, setOtpVerifyOpen] = useState(false);
  const [verifyOtpInput, setVerifyOtpInput] = useState("");
  const [twoFactorMsg, setTwoFactorMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Password Change Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setTwoFactorEnabled(user.twoFactorEnabled || false);
      setTwoFactorMethod(user.twoFactorMethod || "email");
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setIsUpdatingProfile(true);

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });

      const data = await res.json();
      if (res.ok) {
        setProfileMsg({ type: "success", text: "Profile details updated successfully." });
        await refreshUser();
      } else {
        setProfileMsg({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Trigger 2FA Activation with live OTP verification
  const handleToggle2FA = async (enable: boolean) => {
    setTwoFactorMsg(null);
    setDebugOtp(null);

    if (!enable) {
      // Disabling 2FA directly
      setIsUpdating2FA(true);
      try {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twoFactorEnabled: false }),
        });
        if (res.ok) {
          setTwoFactorEnabled(false);
          setTwoFactorMsg({ type: "success", text: "Two-Factor Authentication has been disabled." });
          await refreshUser();
        }
      } finally {
        setIsUpdating2FA(false);
      }
      return;
    }

    // When enabling 2FA, dispatch a test OTP first to verify channel
    if (twoFactorMethod === "mobile" && !phone.trim()) {
      setTwoFactorMsg({
        type: "error",
        text: "Please add your mobile number in Profile Information above before enabling SMS 2FA.",
      });
      return;
    }

    setIsUpdating2FA(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          purpose: "setup_2fa",
          method: twoFactorMethod,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpVerifyOpen(true);
        if (data.debugOtp) setDebugOtp(data.debugOtp);
        setTwoFactorMsg({
          type: "success",
          text: `A 6-digit test verification code was sent to ${data.maskedDestination}. Please confirm below to activate.`,
        });
      } else {
        setTwoFactorMsg({ type: "error", text: data.error || "Failed to dispatch verification OTP." });
      }
    } catch (err: any) {
      setTwoFactorMsg({ type: "error", text: err.message || "Network error sending OTP." });
    } finally {
      setIsUpdating2FA(false);
    }
  };

  const handleVerify2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorMsg(null);
    setIsUpdating2FA(true);

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          otpCode: verifyOtpInput.trim(),
          purpose: "setup_2fa",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTwoFactorEnabled(true);
        setOtpVerifyOpen(false);
        setVerifyOtpInput("");
        setTwoFactorMsg({ type: "success", text: "Two-Factor Authentication is now active on your account!" });
        await refreshUser();
      } else {
        setTwoFactorMsg({ type: "error", text: data.error || "Incorrect verification code." });
      }
    } catch (err: any) {
      setTwoFactorMsg({ type: "error", text: err.message || "Verification failed." });
    } finally {
      setIsUpdating2FA(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: "success", text: "Master password changed successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const errorText = data.details ? data.details.join(" ") : data.error || "Password update failed.";
        setPasswordMsg({ type: "error", text: errorText });
      }
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account & Security Maintenance</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your credentials, complex password standards, and Two-Factor Authentication (2FA).
        </p>
      </div>

      {/* Profile Information Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <span>👤</span> User Profile Information
        </h3>

        {profileMsg && (
          <div
            className={`p-3 rounded-xl text-xs ${
              profileMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Email Address (Login ID)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Mobile Phone Number (for SMS 2FA)</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">
              Required if you choose SMS/Mobile as your Two-Factor Authentication channel.
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-5 py-2.5 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isUpdatingProfile ? "Saving Profile..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication (2FA) Maintenance Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>🛡️</span> Two-Factor Authentication (2FA OTP)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Require a 6-digit one-time password on every login to protect your financial data.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                twoFactorEnabled
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {twoFactorEnabled ? "2FA Active" : "2FA Disabled"}
            </span>
            <button
              type="button"
              disabled={isUpdating2FA}
              onClick={() => handleToggle2FA(!twoFactorEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                twoFactorEnabled
                  ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              }`}
            >
              {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          </div>
        </div>

        {twoFactorMsg && (
          <div
            className={`p-3 rounded-xl text-xs ${
              twoFactorMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {twoFactorMsg.text}
          </div>
        )}

        {debugOtp && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center justify-between">
            <span>
              <strong>Demo Test OTP Code:</strong> <span className="font-mono text-sm font-bold tracking-widest">{debugOtp}</span>
            </span>
            <button
              onClick={() => setVerifyOtpInput(debugOtp)}
              className="text-[11px] bg-white border border-purple-200 px-2 py-0.5 rounded-lg text-[#6558D3] font-semibold"
            >
              Auto-Fill
            </button>
          </div>
        )}

        {/* Channel Selection */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-700 block">
            Preferred 2FA Delivery Channel
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label
              className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                twoFactorMethod === "email"
                  ? "border-[#6558D3] bg-purple-50/40 text-[#6558D3]"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="twoFactorMethod"
                value="email"
                checked={twoFactorMethod === "email"}
                onChange={() => setTwoFactorMethod("email")}
                className="mt-0.5 accent-[#6558D3]"
              />
              <div>
                <span className="font-bold block text-sm">Email ID</span>
                <span className="text-gray-500 block text-xs mt-0.5">
                  Sends 6-digit code to {user?.email || "your registered email"}
                </span>
              </div>
            </label>

            <label
              className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-start gap-3 ${
                twoFactorMethod === "mobile"
                  ? "border-[#6558D3] bg-purple-50/40 text-[#6558D3]"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="twoFactorMethod"
                value="mobile"
                checked={twoFactorMethod === "mobile"}
                onChange={() => setTwoFactorMethod("mobile")}
                className="mt-0.5 accent-[#6558D3]"
              />
              <div>
                <span className="font-bold block text-sm">Mobile Phone (SMS OTP)</span>
                <span className="text-gray-500 block text-xs mt-0.5">
                  Sends 6-digit code to {user?.phone || "your phone number"}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Verification Modal / Inline Drawer */}
        {otpVerifyOpen && (
          <form onSubmit={handleVerify2FASetup} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 text-xs">
            <h4 className="font-bold text-gray-900 text-sm">Confirm & Activate 2FA</h4>
            <p className="text-gray-500">
              Enter the 6-digit code dispatched to your {twoFactorMethod === "mobile" ? "mobile phone" : "email"} to verify delivery.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="123456"
                value={verifyOtpInput}
                onChange={(e) => setVerifyOtpInput(e.target.value.replace(/\D/g, ""))}
                className="w-48 px-3.5 py-2 font-mono text-center text-lg tracking-widest font-bold bg-white rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
              <button
                type="submit"
                disabled={isUpdating2FA || verifyOtpInput.length !== 6}
                className="px-5 py-2 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isUpdating2FA ? "Verifying..." : "Verify & Enable"}
              </button>
              <button
                type="button"
                onClick={() => setOtpVerifyOpen(false)}
                className="px-3 py-2 text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change Password Card with Complex Standard Rules */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🔑</span> Change Master Password
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Update your login credentials following strict complex password standards.
          </p>
        </div>

        {passwordMsg && (
          <div
            className={`p-3 rounded-xl text-xs ${
              passwordMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Current Password *</label>
            <input
              type="password"
              required
              placeholder="Enter existing password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">New Complex Password *</label>
              <input
                type="password"
                required
                placeholder="Must meet standard rules"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#6558D3]/30"
              />
            </div>
          </div>

          {/* Standard Rules Real-time Feedback */}
          {newPassword.length > 0 && <PasswordStrengthIndicator password={newPassword} />}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="px-5 py-2.5 bg-[#6558D3] hover:bg-[#5244bd] text-white font-semibold rounded-xl text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isChangingPassword ? "Updating Security Credentials..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Account Termination / Sign out */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Session & Authentication</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Log out from your current device and clear authentication cookies.
          </p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs transition cursor-pointer"
        >
          Sign Out of Fundflow
        </button>
      </div>
    </div>
  );
}
