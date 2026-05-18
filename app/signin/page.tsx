"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone, ShieldCheck } from "lucide-react";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import { auth } from "../../firebase";
import { AuthService } from "../../services/authService";

export default function SignInPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [customerUsername, setCustomerUsername] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      recaptchaVerifier.current?.clear();
      recaptchaVerifier.current = null;
    };
  }, []);

  const normalizePhoneForFirebase = (value: string) => {
    const trimmed = value.trim();

    if (trimmed.startsWith("+")) {
      return trimmed.replace(/\s/g, "");
    }

    const digits = trimmed.replace(/[^\d]/g, "");
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  };

  const getRecaptchaVerifier = () => {
    if (!auth) {
      return null;
    }

    if (!recaptchaVerifier.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(
        auth,
        "lderly-phone-recaptcha",
        {
          size: "invisible",
          callback: () => undefined
        }
      );
    }

    return recaptchaVerifier.current;
  };

  const sendOtp = async () => {
    setAuthError("");
    setAuthMessage("");

    if (phone.trim().length < 8) {
      setAuthError("Enter a valid phone number to continue.");
      return;
    }

    if (!auth) {
      setAuthMessage("Local fallback OTP is active because Firebase Auth is not configured.");
      setOtpSent(true);
      return;
    }

    setAuthBusy(true);

    try {
      const verifier = getRecaptchaVerifier();

      if (!verifier) {
        throw new Error("Firebase Auth is not ready.");
      }

      const result = await signInWithPhoneNumber(
        auth,
        normalizePhoneForFirebase(phone),
        verifier
      );

      setConfirmation(result);
      setOtpSent(true);
      setAuthMessage("OTP sent securely with Firebase.");
    } catch {
      recaptchaVerifier.current?.clear();
      recaptchaVerifier.current = null;
      setAuthError(
        "Could not send Firebase OTP. Check Firebase Phone Auth and authorized domains."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const verifyOtp = async () => {
    setAuthError("");
    setAuthMessage("");

    if (otp.trim().length < 4) {
      setAuthError("Enter the OTP sent to your phone.");
      return;
    }

    if (confirmation) {
      setAuthBusy(true);

      try {
        const credential = await confirmation.confirm(otp.trim());
        const idToken = await credential.user.getIdToken();
        const response = await fetch("/api/auth/firebase-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            idToken,
            role: "customer",
            name: credential.user.phoneNumber || "Customer"
          })
        });

        if (!response.ok || response.status === 202) {
          setAuthError("Firebase sign-in succeeded, but backend session creation failed.");
          return;
        }

        AuthService.storeSignedSession({
          uid: credential.user.uid,
          name: credential.user.phoneNumber || "Customer",
          role: "customer",
          authMode: "firebase"
        });
        router.replace("/");
        return;
      } catch {
        setAuthError("Could not verify the Firebase OTP. Please try again.");
      } finally {
        setAuthBusy(false);
      }

      return;
    }

    const response = await fetch("/api/auth/customer/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone,
        otp
      })
    });

    if (!response.ok) {
      setAuthError("Could not verify OTP. Please try again.");
      return;
    }

    const session = (await response.json()) as { uid: string; name: string };
    AuthService.storeSignedSession({
      uid: session.uid,
      name: session.name || "Customer",
      role: "customer",
      authMode: "demo"
    });
    router.replace("/");
  };

  const continueWithGoogle = async () => {
    setAuthError("");

    try {
      await AuthService.continueWithGoogle("customer");
      router.replace("/");
    } catch {
      setAuthError("Google sign-in is not enabled yet. Please use phone OTP.");
    }
  };

  const continueWithCustomerCredentials = async () => {
    setAuthError("");

    const response = await fetch("/api/auth/customer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: customerUsername,
        password: customerPassword
      })
    });

    if (!response.ok) {
      setAuthError("Check the customer username and password.");
      return;
    }

    const session = (await response.json()) as { uid: string; name: string };
    AuthService.storeSignedSession({
      uid: session.uid || "demo-customer",
      name: session.name || "Customer",
      role: "customer",
      authMode: "demo"
    });
    router.replace("/");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#06130f] px-4 py-6 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-between">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">LDERLY</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Care arrives on demand.
          </h1>
          <p className="mt-3 text-base leading-7 text-white/60">
            Sign in with phone OTP or Google to book care, track visits, and receive family updates.
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            {otpSent ? (
              <ShieldCheck className="h-6 w-6 text-emerald-700" />
            ) : (
              <Phone className="h-6 w-6 text-emerald-700" />
            )}
          </div>
          <h2 className="mt-5 text-2xl font-semibold">
            {otpSent ? "Verify OTP" : "Phone number login"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {otpSent
              ? "Enter the verification code sent to your phone."
              : "Phone OTP is the primary way to access the customer Home app."}
          </p>

          {!otpSent ? (
            <>
              <label className="mt-5 block text-sm font-medium text-slate-600">
                Phone number
              </label>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
              />
              <button
                onClick={sendOtp}
                disabled={authBusy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? "Sending..." : "Send OTP"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                onClick={continueWithGoogle}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-4 font-semibold text-[#06130f]"
              >
                <Mail className="h-5 w-5" />
                Continue with Google
              </button>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">test login</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-3">
                <input
                  autoComplete="username"
                  value={customerUsername}
                  onChange={(event) => setCustomerUsername(event.target.value)}
                  placeholder="Customer username"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
                />
                <input
                  autoComplete="current-password"
                  type="password"
                  value={customerPassword}
                  onChange={(event) => setCustomerPassword(event.target.value)}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
                />
              </div>
              <button
                onClick={continueWithCustomerCredentials}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-100 px-5 py-4 font-semibold text-[#06130f]"
              >
                Continue as Customer
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <label className="mt-5 block text-sm font-medium text-slate-600">OTP</label>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="1234"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
              />
              <button
                onClick={verifyOtp}
                disabled={authBusy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? "Verifying..." : "Open Home"}
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                  setAuthError("");
                  setAuthMessage("");
                  setConfirmation(null);
                }}
                className="mt-3 w-full rounded-full bg-slate-100 px-5 py-4 font-semibold text-[#06130f]"
              >
                Change phone number
              </button>
            </>
          )}

          <div id="lderly-phone-recaptcha" />
          {authMessage && <p className="mt-4 text-sm text-emerald-700">{authMessage}</p>}
          {authError && <p className="mt-4 text-sm text-amber-700">{authError}</p>}
        </motion.section>
      </div>
    </main>
  );
}
