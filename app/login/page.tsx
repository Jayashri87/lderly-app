"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { AuthService } from "../../services/authService";

const lderlyContactHref = "tel:+919916960524";
const lderlyContactNumber = "+91 99169 60524";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Enter the customer ID and password shared by LDERLY.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      if (!response.ok) {
        setError("Check your customer ID and password.");
        return;
      }

      const payload = (await response.json()) as {
        uid?: string;
        name?: string;
        role?: "customer";
      };

      AuthService.storeSignedSession({
        uid: payload.uid || "demo-customer",
        name: payload.name || "Customer",
        role: "customer",
        authMode: "demo"
      });
      router.replace("/");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#06130f] px-4 py-5 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.16),transparent_28%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-md flex-col gap-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200">LDERLY</p>
            <h1 className="mt-1 text-3xl font-semibold">Customer login</h1>
          </div>
          <Link
            href="/signin"
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/75 backdrop-blur"
          >
            Register
          </Link>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/25 backdrop-blur"
        >
          <motion.div
            aria-hidden
            animate={{ x: ["-12%", "22%", "-12%"], opacity: [0.16, 0.32, 0.16] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-16 left-8 h-40 w-40 rounded-full bg-emerald-300/40 blur-3xl"
          />
          <div className="relative">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-300/15 text-emerald-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight">
              Enter your care account.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/68">
              Use the customer ID and password created by the LDERLY care team after registration.
            </p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <UserRound className="h-4 w-4" />
                Customer ID
              </span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Customer ID"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <LockKeyhole className="h-4 w-4" />
                Password
              </span>
              <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 pr-3 focus-within:border-emerald-400">
                <input
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-4 text-base outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid h-10 w-10 place-items-center rounded-full text-slate-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>
          </div>

          {error && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">{error}</p>}

          <button
            onClick={login}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Open customer app"}
            <ArrowRight className="h-5 w-5" />
          </button>

          <a
            href={lderlyContactHref}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-4 font-semibold text-[#06130f]"
          >
            <Phone className="h-5 w-5 text-emerald-700" />
            Need help? Call {lderlyContactNumber}
          </a>

          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            New to LDERLY?{" "}
            <Link href="/signin" className="font-semibold text-[#06130f] underline">
              Request registration callback
            </Link>
          </p>
        </motion.section>
      </div>
    </main>
  );
}
