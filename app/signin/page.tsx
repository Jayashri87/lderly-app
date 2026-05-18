"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone, UserRound } from "lucide-react";
import { AuthService } from "../../services/authService";

export default function SignInPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const continueWithProfile = async () => {
    setAuthError("");

    if (name.trim().length < 2) {
      setAuthError("Enter your name to continue.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setAuthError("Enter a valid email address.");
      return;
    }

    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 8) {
      setAuthError("Enter a valid phone number.");
      return;
    }

    setAuthBusy(true);

    try {
      const response = await fetch("/api/auth/customer/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim()
        })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setAuthError(result?.error || "Could not open your customer account.");
        return;
      }

      const session = (await response.json()) as {
        uid: string;
        name: string;
        email?: string;
        phone?: string;
      };

      AuthService.storeSignedSession({
        uid: session.uid,
        name: session.name || name.trim(),
        role: "customer",
        authMode: "demo"
      });
      router.replace("/");
    } catch {
      setAuthError("Could not connect right now. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#06130f] px-4 py-6 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-between gap-8">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">LDERLY</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Care arrives on demand.
          </h1>
          <p className="mt-3 text-base leading-7 text-white/60">
            Tell us who you are so we can personalize care booking and family updates.
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <UserRound className="h-6 w-6 text-emerald-700" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">Create your care profile</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            No OTP required. We will use these details for booking, updates, and care
            coordination.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <UserRound className="h-4 w-4" />
                Your name
              </span>
              <input
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jayashri"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Mail className="h-4 w-4" />
                Email address
              </span>
              <input
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Phone className="h-4 w-4" />
                Phone number
              </span>
              <input
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 99169 60524"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
              />
            </label>
          </div>

          <button
            onClick={continueWithProfile}
            disabled={authBusy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authBusy ? "Opening..." : "Continue"}
            <ArrowRight className="h-5 w-5" />
          </button>

          {authError && <p className="mt-4 text-sm text-amber-700">{authError}</p>}
        </motion.section>
      </div>
    </main>
  );
}
