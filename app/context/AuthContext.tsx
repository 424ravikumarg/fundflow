"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  twoFactorEnabled: boolean;
  twoFactorMethod: "email" | "mobile";
}

interface LoginResult {
  success?: boolean;
  requires2FA?: boolean;
  userId?: string;
  method?: "email" | "mobile";
  maskedDestination?: string;
  message?: string;
  debugOtp?: string;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (name: string, email: string, phone: string, password: string) => Promise<{ success?: boolean; error?: string; details?: string[] }>;
  verify2FA: (userId: string, otpCode: string, purpose?: string) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (userId: string, purpose?: string, method?: "email" | "mobile") => Promise<{ success: boolean; message?: string; debugOtp?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to load user session:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Login failed" };
      }

      if (data.requires2FA) {
        return {
          requires2FA: true,
          userId: data.userId,
          method: data.method,
          maskedDestination: data.maskedDestination,
          message: data.message,
          debugOtp: data.debugOtp,
        };
      }

      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { error: err.message || "Network error during login" };
    }
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Registration failed", details: data.details };
      }

      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { error: err.message || "Network error during registration" };
    }
  };

  const verify2FA = async (userId: string, otpCode: string, purpose = "login_2fa") => {
    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otpCode, purpose }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "Verification failed" };
      }

      if (data.user) {
        setUser(data.user);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during verification" };
    }
  };

  const requestOtp = async (userId: string, purpose = "login_2fa", method?: "email" | "mobile") => {
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, purpose, method }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || "Failed to send code" };
      return { success: true, message: data.message, debugOtp: data.debugOtp };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/me", { method: "DELETE" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verify2FA,
        requestOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
