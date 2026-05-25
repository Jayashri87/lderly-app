"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  Pause,
  Phone,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";

const lderlyContactNumber = "+91 99169 60524";
const lderlyContactHref = "tel:+919916960524";
const adSlides = [
  {
    eyebrow: "For families away from home",
    title: "Is Mom okay right now?",
    body: "LDERLY helps families arrange trusted care and stay reassured throughout the visit.",
    stat: "Live family updates"
  },
  {
    eyebrow: "Verified care support",
    title: "A trained caregiver, not just a booking.",
    body: "We understand the care need first, then help create the right care plan for your parent.",
    stat: "Human-led onboarding"
  },
  {
    eyebrow: "Care with visibility",
    title: "You know what happened, when it happened.",
    body: "Visits, medicine support, doctor help, companionship, and updates become easier to follow.",
    stat: "Trust-first coordination"
  },
  {
    eyebrow: "Start with a call",
    title: "Share your details. We will guide the rest.",
    body: "Our team will call, verify the requirement, create your ID, and help with the first booking.",
    stat: "No OTP. No confusion."
  }
];

export default function SignInPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [careFor, setCareFor] = useState("Mother");
  const [careNeed, setCareNeed] = useState("Need help deciding");
  const [preferredContact, setPreferredContact] = useState("Phone call");
  const [leadError, setLeadError] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [adPaused, setAdPaused] = useState(false);

  useEffect(() => {
    if (showLeadForm || adPaused) {
      return;
    }

    const slideTimer = window.setInterval(() => {
      setAdIndex((current) => (current + 1) % adSlides.length);
    }, 9000);

    return () => {
      window.clearInterval(slideTimer);
    };
  }, [adPaused, showLeadForm]);

  const showPreviousAd = () => {
    setAdPaused(true);
    setAdIndex((current) => (current === 0 ? adSlides.length - 1 : current - 1));
  };

  const showNextAd = () => {
    setAdPaused(true);
    setAdIndex((current) => (current + 1) % adSlides.length);
  };

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
          careFor,
          careNeed,
          preferredContact,
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
          {!showLeadForm && !leadSubmitted ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur"
              >
                Customer login
              </Link>
              <button
                onClick={() => setShowLeadForm(true)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur"
              >
                Skip
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur"
            >
              Customer login
            </Link>
          )}
        </motion.header>

        {!showLeadForm && !leadSubmitted ? (
          <motion.section
            initial={{ opacity: 0, scale: 0.98, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex min-h-[68vh] flex-col justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/25 backdrop-blur"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setAdPaused((paused) => !paused);
              }
            }}
          >
            <motion.div
              aria-hidden
              animate={{
                x: ["-16%", "28%", "-16%"],
                y: [0, 22, 0],
                opacity: [0.18, 0.38, 0.18]
              }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-20 left-6 h-48 w-48 rounded-full bg-emerald-300/40 blur-3xl"
            />
            <motion.div
              aria-hidden
              animate={{ rotate: [0, 4, 0], y: [0, -16, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute right-5 top-16 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur"
            >
              <ShieldCheck className="h-8 w-8 text-emerald-200" />
            </motion.div>

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/15 px-3 py-2 text-xs font-semibold text-emerald-100">
                  <Sparkles className="h-4 w-4" />
                  LDERLY
                </div>
                <button
                  onClick={() => setAdPaused((paused) => !paused)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/75"
                >
                  {adPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {adPaused ? "Play" : "Pause"}
                </button>
              </div>

              <motion.div
                key={adIndex}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.55 }}
                className="mt-12"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                  {adSlides[adIndex].eyebrow}
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tight">
                  {adSlides[adIndex].title}
                </h1>
                <p className="mt-5 text-base leading-7 text-white/68">
                  {adSlides[adIndex].body}
                </p>
                <div className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                  <CheckCircle2 className="h-5 w-5 text-emerald-200" />
                  {adSlides[adIndex].stat}
                </div>
              </motion.div>
            </div>

            <div className="relative">
              <p className="mb-3 text-center text-xs font-medium text-white/55">
                Use previous / next to read at your pace.
              </p>
              <div className="mb-4 grid grid-cols-4 gap-2">
                {adSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    onClick={() => {
                      setAdPaused(true);
                      setAdIndex(index);
                    }}
                    className="h-2 overflow-hidden rounded-full bg-white/15"
                    aria-label={`Show message ${index + 1}`}
                  >
                    <motion.div
                      className="h-full rounded-full bg-emerald-200"
                      initial={{ width: "0%" }}
                      animate={{
                        width:
                          index < adIndex || index === adIndex
                            ? "100%"
                            : "0%"
                      }}
                      transition={{ duration: 0.2, ease: "linear" }}
                    />
                  </button>
                ))}
              </div>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <button
                  onClick={showPreviousAd}
                  className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-3 text-xs font-semibold text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() => setAdPaused((paused) => !paused)}
                  className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-3 text-xs font-semibold text-white"
                >
                  {adPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {adPaused ? "Play" : "Pause"}
                </button>
                <button
                  onClick={showNextAd}
                  className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-3 text-xs font-semibold text-white"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => setShowLeadForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-sm font-semibold text-[#06130f] shadow-xl shadow-black/20"
              >
                Request care callback
                <ArrowRight className="h-5 w-5" />
              </button>
              <a
                href={lderlyContactHref}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-4 text-sm font-semibold text-white"
              >
                <Phone className="h-5 w-5 text-emerald-200" />
                Call now: {lderlyContactNumber}
              </a>
            </div>
          </motion.section>
        ) : (
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
            </div>
          </motion.section>
        )}

        {(showLeadForm || leadSubmitted) && <motion.section
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
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-[#06130f]"
                >
                  I already have customer login
                </Link>
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

                <div>
                  <span className="text-sm font-medium text-slate-600">Who needs care?</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {["Mother", "Father", "Self / Others"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCareFor(option)}
                        className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                          careFor === option
                            ? "bg-[#06130f] text-white"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-600">What help is needed?</span>
                  <select
                    value={careNeed}
                    onChange={(event) => setCareNeed(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-emerald-400"
                  >
                    <option>Need help deciding</option>
                    <option>Doctor visit / appointment</option>
                    <option>Medicine help</option>
                    <option>Lab test / report collection</option>
                    <option>Hospital attender</option>
                    <option>Companionship / temple visit</option>
                    <option>Daily support</option>
                    <option>Immediate assistance</option>
                  </select>
                </label>

                <div>
                  <span className="text-sm font-medium text-slate-600">Preferred contact</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {["Phone call", "WhatsApp"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPreferredContact(option)}
                        className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                          preferredContact === option
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
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

              <Link
                href="/login"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-5 py-4 font-semibold text-[#06130f]"
              >
                Already registered? Customer login
              </Link>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-4 w-4" />
                LDERLY team will contact you before account creation.
              </div>
              {leadError && <p className="mt-4 text-sm text-amber-700">{leadError}</p>}
            </>
          )}
        </motion.section>}
      </div>
    </main>
  );
}
