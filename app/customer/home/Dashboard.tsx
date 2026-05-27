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
import { Avatar } from "../onboarding/RecipientSetup";

export function CompactStatus({
  recipient,
  health,
  booking,
  journey,
  hasCareSubscription
}: {
  recipient: Recipient;
  health: HealthSnapshot | null;
  booking: CareBooking | null;
  journey: CareJourney | null;
  hasCareSubscription: boolean;
}) {
  const journeyActive = journey && journey.status !== "idle";
  const bookingActive = booking && booking.status !== "none";
  const careState = careStatusFor({ booking, journey });
  const medicineState =
    health?.medicineStatus === "completed"
      ? "Medicine completed"
      : health?.medicineStatus === "missed"
        ? "Medicine needs follow-up"
        : "Medicine schedule ready";
  const wellnessScore = health?.wellness === "watch" ? "84%" : "92%";

  return (
    <section className="rounded-[2rem] bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            {hasCareSubscription ? `${recipient.shortName} Today` : "Care setup"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {hasCareSubscription
              ? careState
              : `Let's find the right support for ${recipient.shortName}`}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {hasCareSubscription
              ? `Last checked 2 mins ago - ${medicineState}`
              : "Live status appears after the first care service is booked."}
          </p>
        </div>
        <Avatar recipient={recipient} />
      </div>
      {hasCareSubscription ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="Mood" value={health?.wellness === "watch" ? "Watch" : "Positive"} />
          <MiniMetric label="Stable" value={wellnessScore} />
          <MiniMetric label="Care" value={journeyActive || bookingActive ? "Active" : "Completed"} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
          Once a service is subscribed or booked, this card will show caregiver status,
          medicine progress, mood, and care score.
        </div>
      )}
    </section>
  );
}

export function RealtimeCareStrip({
  activeCare,
  service,
  recipient
}: {
  activeCare: boolean;
  service: string;
  recipient: Recipient;
}) {
  const status = activeCare
    ? `${service || "Care"} live for ${recipient.shortName}`
    : `Ready to arrange care for ${recipient.shortName}`;

  return (
    <section className="glass-panel mt-4 overflow-hidden rounded-[1.5rem] p-3">
      <div className="flex items-center gap-3">
        <span className="live-dot shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Realtime care system
          </p>
          <p className="mt-1 truncate text-sm text-white/70">{status}</p>
        </div>
        <span className="rounded-full bg-gradient-to-r from-emerald-200 to-teal-200 px-3 py-1 text-xs font-semibold text-[#06130f]">
          {activeCare ? "Live" : "Ready"}
        </span>
      </div>
    </section>
  );
}

export function PrimaryCareCta({
  recipient,
  onBook
}: {
  recipient: Recipient;
  onBook: () => void;
}) {
  return (
    <section className="premium-card motion-lift mt-5 rounded-[2rem] p-5">
      <p className="text-sm font-semibold text-emerald-800">Primary action</p>
      <h2 className="premium-title mt-2 text-3xl font-semibold tracking-tight">
        Get care for {recipient.shortName}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Answer a few quick questions and we will guide you to the right support.
      </p>
      <button
        onClick={onBook}
        className="motion-lift mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white shadow-xl shadow-emerald-950/20"
      >
        Continue
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}

export function QuickActions({
  activeCare,
  experience,
  onTrack,
  onBook,
  onRebook
}: {
  activeCare: boolean;
  experience: ReturnType<typeof serviceExperienceFor>;
  onTrack: () => void;
  onBook: () => void;
  onRebook: () => void;
}) {
  return (
    <section className="mt-5 grid grid-cols-2 gap-3">
      <button
        onClick={activeCare ? onTrack : onBook}
        className="glass-panel motion-lift rounded-[1.5rem] p-4 text-left"
      >
        {activeCare ? (
          <MapPinned className="h-5 w-5 text-emerald-200" />
        ) : (
          <HeartPulse className="h-5 w-5 text-emerald-200" />
        )}
        <p className="mt-3 font-semibold">
          {activeCare ? experience.trackLabel : "Book care now"}
        </p>
        <p className="mt-1 text-sm text-white/45">
          {activeCare ? "Live updates ready" : "Start a guided request"}
        </p>
      </button>
      <button
        onClick={onRebook}
        className="glass-panel motion-lift rounded-[1.5rem] p-4 text-left"
      >
        <Repeat2 className="h-5 w-5 text-emerald-200" />
        <p className="mt-3 font-semibold">{experience.rebookLabel}</p>
        <p className="mt-1 text-sm text-white/45">Request familiar support</p>
      </button>
    </section>
  );
}

export function CareConfidence({
  recipient,
  health
}: {
  recipient: Recipient;
  health: HealthSnapshot | null;
}) {
  return (
    <section className="trust-surface mt-5 rounded-[1.5rem] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/50">Daily Care Score</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {recipient.shortName} Today
          </h3>
        </div>
        <div className="rounded-full bg-emerald-300 px-4 py-2 font-semibold text-[#06130f]">
          {health?.wellness === "watch" ? "84%" : "92%"} Stable
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-white/55">
        {["Meals", "Medicine", "Vitals", "Activity"].map((item) => (
          <div key={item} className="rounded-2xl bg-white/10 px-2 py-3">
            <Check className="mx-auto mb-1 h-4 w-4 text-emerald-200" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MedicalRiskPanel({
  recipient,
  risk
}: {
  recipient: Recipient;
  risk: CareRiskSummary | null;
}) {
  const riskTone =
    risk?.riskLevel === "high"
      ? "bg-red-500/20 text-red-50"
      : risk?.riskLevel === "watch"
        ? "bg-amber-200/15 text-amber-50"
        : "bg-emerald-200/10 text-emerald-50";
  const signals = risk?.riskSignals?.length
    ? risk.riskSignals
    : ["No urgent medical risk signals", "Emergency contact readiness active"];

  return (
    <section className={`mt-5 rounded-[1.5rem] p-4 ${riskTone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white/60">Medical readiness</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {risk?.riskLevel === "high"
              ? `${recipient.shortName} needs attention`
              : risk?.riskLevel === "watch"
                ? `${recipient.shortName} is on watch`
                : `${recipient.shortName} looks stable`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {risk?.recommendations?.[0] ||
              "We combine medicines, vitals, profile flags, incidents, and emergency readiness into one care view."}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#06130f]">
          {risk?.riskScore ?? 18}/100
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-white/65">
        <div className="rounded-2xl bg-white/10 p-3">
          Fall
          <p className="mt-1 font-semibold text-white">{risk?.fallRisk || "low"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          Medicine
          <p className="mt-1 font-semibold text-white">{risk?.medicationRisk || "stable"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          Vitals
          <p className="mt-1 font-semibold text-white">{risk?.vitalsRisk || "stable"}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          SOS
          <p className="mt-1 font-semibold text-white">{risk?.emergencyReadinessScore ?? 85}%</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[...signals, ...(risk?.chronicConditionFlags || [])].slice(0, 5).map((signal) => (
          <span
            key={signal}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70"
          >
            {signal}
          </span>
        ))}
      </div>
      {risk?.missedCareSignals?.length ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm text-white/70">
          Missed-care signals: {risk.missedCareSignals.join(", ")}
        </div>
      ) : null}
    </section>
  );
}

export function FamilyReassuranceSystem({
  recipient,
  health,
  booking,
  journey,
  reports,
  experience,
  aiInsight
}: {
  recipient: Recipient;
  health: HealthSnapshot | null;
  booking: CareBooking | null;
  journey: CareJourney | null;
  reports: VisitReport[];
  experience: ReturnType<typeof serviceExperienceFor>;
  aiInsight: AiReassuranceInsight | null;
}) {
  const activeService = cleanServiceName(journey?.serviceType || booking?.serviceType);
  const hasLiveCare = Boolean(
    (journey && journey.status !== "idle") || (booking && booking.status !== "none")
  );
  const latestReport = reports[0];
  const wellbeing =
    health?.wellness === "watch"
      ? `${recipient.shortName} needs a little attention`
      : `${recipient.shortName} looks okay right now`;
  const familyLine = latestReport
    ? latestReport.familySummary
    : hasLiveCare
      ? `${experience.feed[0]} Family updates are active.`
      : "Book a service and this becomes the realtime family care board.";

  return (
    <section className="mt-5 space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-100">
              Family reassurance
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {wellbeing}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/55">{familyLine}</p>
          </div>
          <span className="live-dot mt-2 shrink-0" aria-hidden="true" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <TrustSignal label="Caregiver" value={hasLiveCare ? "Live" : "Ready"} />
          <TrustSignal label="Family" value="Updated" />
          <TrustSignal label="Emergency" value="Active" />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <InsightCard
          eyebrow="AI insight"
          title={
            aiInsight?.headline ||
            (health?.medicineStatus === "missed" ? "Medicine follow-up" : "Routine looks steady")
          }
          body={
            aiInsight?.summary ||
            (health?.medicineStatus === "missed"
              ? "Medicine support should be prioritized in the next visit."
              : `${activeService || experience.profilePreference} is aligned with the current care plan.`)
          }
          icon={Sparkles}
        />
        <InsightCard
          eyebrow="NRI updates"
          title="Family visibility on"
          body="WhatsApp, voice notes, and visit summaries are ready for remote family coordination."
          icon={MessageCircle}
        />
      </div>
      <AiDailyCareSummary
        recipient={recipient}
        insight={aiInsight}
        fallback={`${recipient.shortName}'s care plan is connected across family, caregiver, and ops.`}
      />
      <TrustVisibilityPanel recipient={recipient} hasLiveCare={hasLiveCare} />
    </section>
  );
}

export function AiDailyCareSummary({
  recipient,
  insight,
  fallback
}: {
  recipient: Recipient;
  insight: AiReassuranceInsight | null;
  fallback: string;
}) {
  return (
    <section className="rounded-[1.5rem] bg-emerald-200/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-300 text-[#06130f]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-100">AI daily care summary</p>
          <h3 className="mt-1 text-xl font-semibold">
            {insight?.headline || `${recipient.shortName}'s care looks organized`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {insight?.emotionalMessage || fallback}
          </p>
          <p className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-white/65">
            Next best action: {insight?.nextAction || "Keep the next care update visible for family."}
          </p>
        </div>
      </div>
    </section>
  );
}

export function TrustVisibilityPanel({
  recipient,
  hasLiveCare
}: {
  recipient: Recipient;
  hasLiveCare: boolean;
}) {
  return (
    <Card className="bg-white/10">
      <CardHeader>
        <div>
          <CardTitle>Trust is visible</CardTitle>
          <CardDescription>
            Every visit keeps family, caregiver, and ops signals connected for {recipient.shortName}.
          </CardDescription>
        </div>
        <Badge variant={hasLiveCare ? "trust" : "default"}>{hasLiveCare ? "Live" : "Ready"}</Badge>
      </CardHeader>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          "Verified caregiver",
          "Police verification",
          "Realtime timestamp",
          "Visit proof ready"
        ].map((item) => (
          <div key={item} className="rounded-2xl bg-white/10 p-3 text-white/70">
            <Check className="mb-1 h-4 w-4 text-emerald-200" />
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CareContinuitySystem({
  summary,
  recipient,
  onBook,
  onRebook
}: {
  summary: RetentionSummary | null;
  recipient: Recipient;
  onBook: () => void;
  onRebook: () => void;
}) {
  const actions = summary?.actions?.length
    ? summary.actions
    : [
        {
          id: "fallback-weekly-care",
          title: "Build a weekly care rhythm",
          body: `Schedule familiar care for ${recipient.shortName} so family updates become predictable.`,
          cta: "Book next visit",
          kind: "recurring" as const,
          serviceType: "Parent Wellness Plan",
          priority: "recommended" as const
        }
      ];
  const primaryAction = actions[0];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white p-4 text-[#06130f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Care continuity</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {summary?.headline || `Keep ${recipient.shortName}'s care predictable`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {summary?.reassuranceLine ||
              "LDERLY will recommend the next best care action after every visit."}
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-center">
          <p className="text-xs font-semibold text-emerald-800">Continuity</p>
          <p className="mt-1 text-xl font-semibold">{summary?.retentionScore ?? 72}%</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-slate-500">Visits</p>
          <p className="mt-1 font-semibold">{summary?.completedVisits ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-slate-500">Plan</p>
          <p className="mt-1 font-semibold">{summary?.recurringActive ? "Active" : "Suggested"}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-slate-500">Digest</p>
          <p className="mt-1 font-semibold">{summary?.familyDigestReady ? "Ready" : "Pending"}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            onClick={action.kind === "rebook" ? onRebook : onBook}
            className="w-full rounded-3xl bg-slate-100 p-4 text-left transition hover:bg-slate-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{action.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">{action.body}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  action.priority === "urgent"
                    ? "bg-red-100 text-red-700"
                    : action.priority === "recommended"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-white text-slate-600"
                }`}
              >
                {action.cta}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={primaryAction.kind === "rebook" ? onRebook : onBook}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-4 py-3 text-sm font-semibold text-white"
      >
        <Repeat2 className="h-4 w-4" />
        {summary?.nextBestAction || primaryAction.cta}
      </button>
    </section>
  );
}

export function TrustedCaregiverProfile({
  recipient,
  booking,
  journey,
  trustProfile,
  onRebook
}: {
  recipient: Recipient;
  booking: CareBooking | null;
  journey: CareJourney | null;
  trustProfile: CaregiverTrustProfile | null;
  onRebook: () => void;
}) {
  const assignedCaregiverName = trustProfile?.name || journey?.caretakerName || booking?.caretakerName || "";
  const caregiverName = assignedCaregiverName || "Caregiver matching after booking";
  const hasAssignedCaregiver = Boolean(
    assignedCaregiverName &&
      assignedCaregiverName !== "Assigning now" &&
      assignedCaregiverName !== "Best caregiver nearby"
  );
  const badges = trustProfile?.badges?.length
    ? trustProfile.badges
    : hasAssignedCaregiver
      ? ["ID verified", "Police checked", "Trained caregiver", "Visit history updating"]
      : ["ID verification", "Police check", "Training status", "Family rating"];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white p-4 text-[#06130f]">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-sky-200 text-2xl font-bold">
          {hasAssignedCaregiver ? caregiverName.charAt(0) : "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-700">Verified caregiver profile</p>
          <h3 className="mt-1 text-2xl font-semibold">{caregiverName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {hasAssignedCaregiver
              ? `Familiar caregiver for ${recipient.shortName}`
              : `Best available caregiver will be shown after matching`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.slice(0, 4).map((signal) => (
              <span
                key={signal}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <CaregiverTrustMetric label="Trust score" value={trustProfile ? `${trustProfile.trustScore}%` : "After match"} />
        <CaregiverTrustMetric label="Punctuality" value={trustProfile ? `${trustProfile.punctualityScore}%` : "After visit"} />
        <CaregiverTrustMetric
          label="Languages"
          value={trustProfile?.languages?.slice(0, 2).join(", ") || "Shown after match"}
        />
      </div>
      <button
        onClick={onRebook}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-4 py-3 text-sm font-semibold text-white"
      >
        <Repeat2 className="h-4 w-4" />
        {hasAssignedCaregiver ? "Rebook same caregiver" : "Book verified caregiver"}
      </button>
    </section>
  );
}

export function CaregiverTrustMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export function SessionSummaryPreview({
  recipient,
  reports
}: {
  recipient: Recipient;
  reports: VisitReport[];
}) {
  const latestReport = reports[0];
  const summaryItems = latestReport
    ? [
        latestReport.vitalsSummary,
        latestReport.medicineSummary,
        latestReport.familySummary,
        latestReport.caregiverNote
      ]
    : [
        `No completed visit summary for ${recipient.shortName} yet.`,
        "Vitals, medicines, caregiver notes, and family handover will appear after the first visit."
      ];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Today&apos;s care summary</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {latestReport ? "Family handover ready" : "Care summary appears after the visit"}
          </h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
          {latestReport ? "Voice note" : "After visit"}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {summaryItems.slice(0, 4).map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 text-sm">
            {latestReport ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            ) : (
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
            )}
            <span className="text-white/70">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VisitProofSystem({
  recipient,
  reports,
  booking,
  journey,
  proof,
  onRebook
}: {
  recipient: Recipient;
  reports: VisitReport[];
  booking: CareBooking | null;
  journey: CareJourney | null;
  proof: VisitProof | null;
  onRebook: () => void;
}) {
  const latestReport = reports[0];
  const timestamp = latestReport?.completedAt || booking?.updatedAt || journey?.updatedAt || 0;
  const confidenceScore =
    proof?.confidenceScore ?? (latestReport ? 92 : booking?.status === "completed" ? 84 : 48);
  const completedChecks =
    proof?.completedChecks?.length
      ? proof.completedChecks
      : latestReport
        ? [
            latestReport.familySummary,
            latestReport.vitalsSummary,
            latestReport.medicineSummary
          ]
        : ["Care proof will unlock after the visit", "Family handover pending"];
  const proofTimeline =
    proof?.timeline?.length
      ? proof.timeline
      : [
          {
            label: booking ? "Request created" : "Request pending",
            at: booking?.createdAt || timestamp,
            verified: Boolean(booking)
          },
          {
            label: latestReport ? "Visit completed" : "Completion pending",
            at: latestReport?.completedAt || timestamp,
            verified: Boolean(latestReport)
          }
        ];
  const proofItems = proof
    ? [
        { label: "Timestamp", value: proof.timestampLabel },
        { label: "Vitals", value: proof.vitalsSummary },
        { label: "Medicine", value: proof.medicineSummary },
        { label: "GPS", value: proof.locationLabel }
      ]
    : latestReport
    ? [
        { label: "Completed", value: timestamp ? new Date(timestamp).toLocaleString() : "Verified after visit" },
        { label: "Vitals", value: latestReport.vitalsSummary },
        { label: "Medicine", value: latestReport.medicineSummary },
        { label: "GPS", value: booking?.tracking?.destinationLabel || journey?.destinationLabel || "Care location verified" }
      ]
    : [
        { label: "Timestamp", value: "Will verify when visit starts" },
        { label: "GPS", value: "Location proof pending" },
        { label: "Care notes", value: "Caregiver note pending" },
        { label: "Family proof", value: "Photo / voice note optional" }
      ];

  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Visit proof</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {latestReport ? "Proof ready for family" : `Proof will appear for ${recipient.shortName}`}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Timestamps, GPS, vitals, medicine status, caregiver notes, and optional media are kept together for family trust.
          </p>
        </div>
        <Badge variant={latestReport ? "trust" : "default"}>{latestReport ? "Verified" : "Pending"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {proofItems.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/45">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-white/75">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-3xl bg-white p-4 text-[#06130f]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Family confidence</p>
            <h4 className="mt-1 text-3xl font-semibold">{confidenceScore}%</h4>
          </div>
          <div className="h-16 w-16 rounded-full bg-emerald-100 p-2">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
              {confidenceScore >= 80 ? "Stable" : "Watch"}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {completedChecks.slice(0, 3).map((item) => (
            <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-100 p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span className="text-slate-600">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {proofTimeline.slice(0, 4).map((item) => (
          <div key={`${item.label}-${item.at}`} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm">
            <span
              className={`h-3 w-3 rounded-full ${
                item.verified ? "bg-emerald-300" : "bg-white/20"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white/80">{item.label}</p>
              <p className="text-xs text-white/40">
                {item.at ? new Date(item.at).toLocaleString() : "Pending"}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/55">
              {item.verified ? "Verified" : "Pending"}
            </span>
          </div>
        ))}
      </div>
      {proof?.proofSignals?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {proof.proofSignals.map((signal) => (
            <span
              key={signal}
              className="rounded-full bg-emerald-200/15 px-3 py-1 text-xs font-semibold text-emerald-100"
            >
              {signal}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {(proof?.attachments || latestReport?.attachments || [
          { label: "Visit photo", status: "pending" as const },
          { label: "Voice summary", status: "pending" as const }
        ]).slice(0, 3).map((attachment) => (
          <div key={attachment.label} className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-sm">
            <span className="text-white/70">{attachment.label}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
              {attachment.status === "not_required" ? "optional" : attachment.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-3xl bg-emerald-200/10 p-4">
        <p className="text-sm font-semibold text-emerald-100">Next best action</p>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {proof?.nextBestAction ||
            (latestReport
              ? "Rate this visit and rebook the same caregiver if the experience felt familiar."
              : "Care proof and next action will appear after completion.")}
        </p>
        <p className="mt-2 text-xs text-white/45">
          {proof?.ratingPrompt || proof?.rebookPrompt || "Rating and rebooking unlock after visit proof is ready."}
        </p>
        <button
          onClick={onRebook}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#06130f]"
        >
          <Repeat2 className="h-4 w-4" />
          {proof?.rebookPrompt ? "Rebook familiar care" : "Plan next care"}
        </button>
      </div>
    </section>
  );
}

export function NriMonthlyReportPreview({
  recipient,
  reports,
  aiInsight
}: {
  recipient: Recipient;
  reports: VisitReport[];
  aiInsight: AiReassuranceInsight | null;
}) {
  const reportReady = reports.length > 0;
  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <p className="text-sm font-semibold text-emerald-100">NRI family report</p>
      <h3 className="mt-1 text-2xl font-semibold">Monthly reassurance preview</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">
        A family-ready summary can combine visits, medicines, vitals, caregiver notes, expenses, and care recommendations.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/60">
        <div className="rounded-2xl bg-white/10 p-3">{reports.length} visits</div>
        <div className="rounded-2xl bg-white/10 p-3">{reportReady ? "Care score ready" : "Care score after visit"}</div>
        <div className="rounded-2xl bg-white/10 p-3">{reportReady ? "PDF ready" : "PDF after visit"}</div>
      </div>
      <p className="mt-4 rounded-2xl bg-white/10 p-3 text-sm text-white/65">
        {aiInsight?.nextAction || `Next update: share ${recipient.shortName}'s weekly summary with family.`}
      </p>
    </section>
  );
}

export function AccessibilityCareControls({ recipient }: { recipient: Recipient }) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
      <p className="text-sm font-semibold text-emerald-100">Elder-friendly mode</p>
      <p className="mt-2 text-sm leading-6 text-white/55">
        Larger touch targets, calmer alerts, voice summaries, and family-first updates are ready for {recipient.shortName}.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/60">
        <div className="rounded-2xl bg-white/10 p-3">Large text</div>
        <div className="rounded-2xl bg-white/10 p-3">Voice notes</div>
        <div className="rounded-2xl bg-white/10 p-3">Family alerts</div>
      </div>
    </section>
  );
}

export function TrustSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function InsightCard({
  eyebrow,
  title,
  body,
  icon: Icon
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/10 p-4">
      <Icon className="h-5 w-5 text-emerald-200" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {eyebrow}
      </p>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 text-white/45">{body}</p>
    </div>
  );
}

export function SmartRecommendation({
  experience,
  recipient,
  service,
  onBook
}: {
  experience: ReturnType<typeof serviceExperienceFor>;
  recipient: Recipient;
  service: string;
  onBook: () => void;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] bg-amber-200/15 p-4">
      <p className="text-sm font-semibold text-amber-100">
        Recommended for today
      </p>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {`${service} is active for ${recipient.shortName}. ${experience.profilePreference}.`}
      </p>
      <button
        onClick={onBook}
        className="mt-4 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#06130f]"
      >
        Continue
      </button>
    </section>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function FirstTimeHome({
  details,
  recipient,
  onBook,
  onImmediate
}: {
  details: RecipientDetails;
  recipient: Recipient;
  onBook: () => void;
  onImmediate: () => void;
}) {
  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-emerald-200 via-white to-amber-100 p-6 text-[#06130f] shadow-2xl shadow-black/20">
      <Avatar recipient={recipient} size="lg" />
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
        First care setup
      </p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight">
        Get care for {recipient.shortName}
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-600">
        {`We have ${details.fullName || recipient.displayName}'s basics. Choose the first care need and LDERLY will guide you through the right service.`}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-slate-600">
        <div className="rounded-2xl bg-white/70 p-3">
          <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-800" />
          Verified care
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <MapPinned className="mx-auto mb-1 h-4 w-4 text-emerald-800" />
          Live tracking
        </div>
        <div className="rounded-2xl bg-white/70 p-3">
          <MessageCircle className="mx-auto mb-1 h-4 w-4 text-emerald-800" />
          Family updates
        </div>
      </div>
      <button
        onClick={onBook}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
      >
        Continue to care options
        <ChevronRight className="h-5 w-5" />
      </button>
      <button
        onClick={onImmediate}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-4 font-semibold text-white shadow-xl shadow-red-500/20"
      >
        Immediate Assistance
      </button>
    </section>
  );
}
