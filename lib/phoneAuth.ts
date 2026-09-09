import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

// Global declaration for TypeScript
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

/**
 * Formats a phone number into international E.164 format (+91XXXXXXXXXX)
 */
export function formatPhoneNumber(phone: string, defaultCountryCode = "+91"): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  // If 10 digits (India standard), prepend +91
  if (/^\d{10}$/.test(cleaned)) {
    return `${defaultCountryCode}${cleaned}`;
  }
  return `${defaultCountryCode}${cleaned}`;
}

/**
 * Initializes or resets the Firebase RecaptchaVerifier on the specified HTML container element
 */
export function setupRecaptcha(containerId = "recaptcha-container"): RecaptchaVerifier {
  if (typeof window === "undefined") {
    throw new Error("Recaptcha can only be initialized on the client side.");
  }

  // Clear existing verifier if any
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch {
      // ignore
    }
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved - allow signInWithPhoneNumber
    },
    "expired-callback": () => {
      console.warn("reCAPTCHA expired. Please try again.");
    },
  });

  window.recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Sends a real SMS with a 6-digit OTP to the user's mobile number via Firebase
 */
export async function sendFirebaseOtpSms(
  rawPhone: string,
  containerId = "recaptcha-container"
): Promise<ConfirmationResult> {
  const formattedPhone = formatPhoneNumber(rawPhone);

  const verifier = setupRecaptcha(containerId);
  await verifier.render();

  const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
  window.confirmationResult = confirmationResult;
  return confirmationResult;
}

/**
 * Verifies the 6-digit OTP code entered by the user
 */
export async function verifyFirebaseOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<UserCredential> {
  return await confirmationResult.confirm(otpCode);
}
