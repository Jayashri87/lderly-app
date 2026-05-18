"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";

const lderlyContactNumber = "+91 99169 60524";
const lderlyContactHref = "tel:+919916960524";

export default function SignInPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [leadError, setLeadError] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const submitLead = async () => {
    setLeadError("");

    if (name.trim().length < 2) {
      setLeadError("Enter your name so our care team knows who to contact.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLeadError("Enter a valid email address.");
      return;
    }

    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 8) {
      setLeadError("Enter a valid contact number.");
      return;
    }

    setLeadBusy(true);

    try {
      const response = await fetch("/api/leads/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          source: "signin-care-interest"
        })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setLeadError(result?.error || "Could not submit your request right now.");
        return;
      }

      setLeadSubmitted(true);
    } catch {
      setLeadError("Could not connect right now. Please try again.");
    } finally {
      setLeadBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#06130f] px-4 py-5 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.16),transparent_28%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-md flex-col gap-5">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200">LDERLY</p>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur">
            Family care
          </span>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, scale: 0.98, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/25 backdrop-blur"
        >
          <motion.div
            aria-hidden
            animate={{ x: ["-20%", "24%", "-20%"], opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-16 left-8 h-36 w-36 rounded-full bg-emerald-300/40 blur-3xl"
          />
          <motion.div
            aria-hidden
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-5 top-6 rounded-3xl border border-white/10 bg-white/10 p-3 backdrop-blur"
          >
            <ShieldCheck className="h-6 w-6 text-emerald-200" />
          </motion.div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/15 px-3 py-2 text-xs font-semibold text-emerald-100">
              <Sparkles className="h-4 w-4" />
              Premium elderly care coordination
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight">
              Care for your parents, arranged with trust.
            </h1>
            <p className="mt-4 text-base leading-7 text-white/68">
              Share your contact details. Our care team will call you, understand your
              family needs, and create your LDERLY account.
            </p>

            <a
              href={lderlyContactHref}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-sm font-semibold text-[#06130f] shadow-xl shadow-black/20"
            >
              <Phone className="h-5 w-5 text-emerald-700" />
              Call LDERLY now
            </a>
            <p className="mt-2 text-center text-xs text-white/55">
              Immediate care enquiry: {lderlyContactNumber}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Verified", "caregivers"],
                ["Live", "updates"],
                ["Family", "support"]
              ].map(([title, subtitle]) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-white/10 p-3 text-center"
                >
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-[11px] text-white/55">{subtitle}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20"
        >
          {leadSubmitted ? (
            <div className="py-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-700" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">Thank you, {name.trim()}.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                We have received your details. Our care team will contact you, explain
                the right care options, and create your customer ID and password.
              </p>
              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                  <Phone className="mt-0.5 h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="text-sm font-semibold">Care consultation call</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      We will call your registered number to understand who needs care.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                  <CalendarCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="text-sm font-semibold">Account setup by LDERLY</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      After verification, we will create your login and guide the first
                      booking.
                    </p>
                  </div>
                </div>
                <a
                  href={lderlyContactHref}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#06130f] px-5 py-4 text-sm font-semibold text-white"
                >
                  <Phone className="h-5 w-5" />
                  Call now: {lderlyContactNumber}
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <UserRound className="h-6 w-6 text-emerald-700" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">Request a care callback</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                No OTP. No self-setup. We will contact you and create the account after
                understanding your care need.
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
                    placeholder="Your full name"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Phone className="h-4 w-4" />
                    Contact number
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

                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Mail className="h-4 w-4" />
                    Email ID
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
              </div>

              <button
                onClick={submitLead}
                disabled={leadBusy}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {leadBusy ? "Submitting..." : "Request callback"}
                <ArrowRight className="h-5 w-5" />
              </button>

              <a
                href={lderlyContactHref}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-4 font-semibold text-[#06130f]"
              >
                <Phone className="h-5 w-5 text-emerald-700" />
                Call us immediately
              </a>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-4 w-4" />
                LDERLY team will contact you before account creation.
              </div>
              {leadError && <p className="mt-4 text-sm text-amber-700">{leadError}</p>}
            </>
          )}
        </motion.section>
      </div>
    </main>
  );
}
