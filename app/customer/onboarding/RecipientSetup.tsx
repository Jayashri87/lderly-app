"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  HeartPulse,
  Languages,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  Mic,
  Phone,
  Pill,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LiveMap from "../../../components/LiveMap";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { LiveActivityTimeline, LiveSystemPanel } from "../../../components/system/LiveSystemPanel";
import { SystemStatusPill } from "../../../components/system/SystemStatusPill";
import { LiveOperationalDock } from "../../../components/realtime/LiveOperationalDock";
import { EmergencyResponseCard } from "../../../components/emergency/EmergencyResponseCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../../../components/ui/dialog";
import { Skeleton } from "../../../components/ui/skeleton";
import type { BookingRequestDetails, CareBooking } from "../../../services/bookingService";
import type { HealthSnapshot } from "../../../services/healthService";
import type { CareProfile } from "../../../services/profileService";
import type { VisitReport } from "../../../services/reportService";
import type { CareJourney } from "../../../services/journeyService";
import { trackProductEvent } from "../../../services/productAnalytics";
import {
  careNeeds,
  careStatusFor,
  cleanServiceName,
  durationOptions,
  emptyRecipientDetails,
  journeySteps,
  recipients,
  serviceExperienceFor,
  timeOptions,
  type AiReassuranceInsight,
  type BookingStep,
  type CaregiverTrustProfile,
  type CareNeed,
  type CareRiskSummary,
  type DurationOption,
  type LocationOption,
  type Recipient,
  type RecipientDetails,
  type RetentionSummary,
  type TimeOption,
  type VisitProof
} from "../customerShared";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-6"
    >
      {children}
    </motion.div>
  );
}

export function RecipientGate({ onSelect }: { onSelect: (recipient: string) => void }) {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#06130f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 pb-10">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">
          LDERLY
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Who are we caring for today?
        </h1>
        <p className="mt-3 text-base leading-7 text-white/60">
          Choose a loved one so we can guide you to the right care.
        </p>

        <div className="mt-8 space-y-3">
          {recipients.map((recipient) => (
            <button
              key={recipient.name}
              onClick={() => onSelect(recipient.name)}
              className="flex w-full items-center gap-4 rounded-[1.75rem] bg-white p-4 text-left text-[#06130f] shadow-2xl shadow-black/15 transition active:scale-[0.99]"
            >
              <Avatar recipient={recipient} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{recipient.displayName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Start care for {recipient.displayName}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          ))}
        </div>

        <div className="mt-auto rounded-[1.5rem] bg-white/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">
            Care arrives on demand.
          </p>
          <p className="mt-1 text-sm text-white/50">
            Premium care coordination, built for families who need calm and clarity.
          </p>
        </div>
      </div>
    </main>
  );
}

export function Avatar({
  recipient,
  size = "md"
}: {
  recipient: Recipient;
  size?: "md" | "lg";
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${recipient.gradient} font-bold text-[#06130f] ${
        size === "lg" ? "h-16 w-16 text-2xl" : "h-12 w-12 text-lg"
      }`}
    >
      {recipient.avatar}
    </div>
  );
}

export function RecipientDetailsSetup({
  recipient,
  onBack,
  onSave
}: {
  recipient: Recipient;
  onBack: () => void;
  onSave: (details: RecipientDetails) => void;
}) {
  const [details, setDetails] = useState<RecipientDetails>({
    ...emptyRecipientDetails,
    fullName: ""
  });

  const updateDetail = (field: keyof RecipientDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const canContinue = details.fullName.trim() && details.age.trim();

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#06130f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(251,191,36,.14),transparent_26%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto min-h-dvh max-w-md px-4 py-6 pb-28">
        <button onClick={onBack} className="rounded-full bg-white/10 px-4 py-2 text-sm">
          Back
        </button>
        <div className="mt-6">
          <Avatar recipient={recipient} size="lg" />
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">
            Tell us about {recipient.displayName}
          </h1>
          <p className="mt-3 text-base leading-7 text-white/60">
            These details help us recommend the right care and brief the caregiver properly.
          </p>
        </div>

        <section className="mt-7 rounded-[2rem] bg-white p-4 text-[#06130f]">
          <p className="text-sm font-semibold text-emerald-700">Required basics</p>
          <div className="mt-4 space-y-3">
          <TextField
            autoComplete="name"
            label={`${recipient.displayName}'s name`}
            placeholder="Full name"
            value={details.fullName}
            onChange={(value) => updateDetail("fullName", value)}
          />
          <TextField
            inputMode="numeric"
            label="Age"
            placeholder="72"
            value={details.age}
            onChange={(value) => updateDetail("age", value)}
          />
          <TextField
            autoComplete="tel"
            inputMode="tel"
            label="Phone / primary contact"
            placeholder="+91 98765 43210"
            value={details.phone}
            onChange={(value) => updateDetail("phone", value)}
          />
          <TextField
            autoComplete="street-address"
            label="Care address"
            placeholder="Home, apartment, or landmark"
            value={details.address}
            onChange={(value) => updateDetail("address", value)}
          />
          </div>
        </section>

        <section className="mt-4 rounded-[2rem] bg-white/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">
            Helpful for the caregiver
          </p>
          <p className="mt-1 text-sm text-white/50">
            Optional now. You can edit this later from Profile.
          </p>
          <div className="mt-4 space-y-3 rounded-[1.5rem] bg-white p-4 text-[#06130f]">
          <TextField
            label="Health notes"
            placeholder="BP, diabetes, recent surgery, routine needs"
            value={details.healthNotes}
            onChange={(value) => updateDetail("healthNotes", value)}
          />
          <TextField
            label="Allergies"
            placeholder="No known allergies"
            value={details.allergies}
            onChange={(value) => updateDetail("allergies", value)}
          />
          <TextField
            label="Mobility"
            placeholder="Walks independently, walker, wheelchair"
            value={details.mobility}
            onChange={(value) => updateDetail("mobility", value)}
          />
          <TextField
            label="Preferred language"
            placeholder="English, Hindi, Kannada..."
            value={details.language}
            onChange={(value) => updateDetail("language", value)}
          />
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 bg-[#06130f]/90 px-4 pb-4 pt-3 backdrop-blur-xl">
          <button
            disabled={!canContinue}
            onClick={() => onSave(details)}
            className="mx-auto block w-full max-w-md rounded-full bg-white px-5 py-4 font-semibold text-[#06130f] disabled:opacity-45"
          >
            Continue
          </button>
        </div>
      </div>
    </main>
  );
}

export function TextField({
  autoComplete,
  inputMode,
  label,
  placeholder,
  value,
  onChange
}: {
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400"
      />
    </label>
  );
}
