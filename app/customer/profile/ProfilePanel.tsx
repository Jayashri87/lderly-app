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

export function ProfilePanel({
  profile,
  recipient,
  details,
  reports,
  serviceExperience,
  onSelectRecipient,
  onEditDetails,
  onInviteFamily,
  onBook,
  onTrack,
  onSignOut
}: {
  profile: CareProfile | null;
  recipient: Recipient;
  details: RecipientDetails;
  reports: VisitReport[];
  serviceExperience: ReturnType<typeof serviceExperienceFor>;
  onSelectRecipient: () => void;
  onEditDetails: () => void;
  onInviteFamily: () => void;
  onBook: () => void;
  onTrack: () => void;
  onSignOut: () => void;
}) {
  const [profileActionMessage, setProfileActionMessage] = useState("");
  const runProfileAction = (label: string) => {
    trackProductEvent("profile_action_clicked", {
      label,
      recipient: recipient.shortName
    });

    if (["Family members", "Family access"].includes(label)) {
      onInviteFamily();
      setProfileActionMessage("Family access form opened. Add the person who should receive care updates.");
      return;
    }

    if (
      [
        "Care preference",
        "Medical readiness",
        "Medication list",
        "Preferred language",
        "Care address"
      ].includes(label)
    ) {
      onEditDetails();
      setProfileActionMessage("Care details reopened so the profile can be updated.");
      return;
    }

    if (label === "Recurring care" || label === "Payment methods") {
      onBook();
      setProfileActionMessage(
        label === "Recurring care"
          ? "Booking opened. Choose Recurring Care in duration to set up a plan."
          : "Booking opened. Payment is managed during booking review."
      );
      return;
    }

    if (label === "Trusted caregivers" || label === "Caregiver verification") {
      onTrack();
      setProfileActionMessage("Care tracking opened so caregiver trust details can be reviewed.");
      return;
    }

    if (
      label === "Refund support" ||
      label === "Help center" ||
      label === "WhatsApp updates" ||
      label === "Notifications"
    ) {
      window.open("https://wa.me/919916960524?text=I%20need%20LDERLY%20support", "_blank");
      setProfileActionMessage("Support opened on WhatsApp so ops can respond quickly.");
      return;
    }

    if (label === "Voice summaries") {
      onTrack();
      setProfileActionMessage("Care tracking opened. Voice summaries appear with visit updates.");
      return;
    }

    if (label === "Privacy and security") {
      window.open("/legal/privacy", "_blank");
      return;
    }

    window.open("https://wa.me/919916960524?text=I%20need%20help%20with%20my%20LDERLY%20profile", "_blank");
    setProfileActionMessage(`${label} support opened on WhatsApp.`);
  };
  const profileSections: Array<{
    title: string;
    rows: Array<{ icon: LucideIcon; label: string; value: string; action?: string }>;
  }> = [
    {
      title: "Care circle",
      rows: [
        {
          icon: Users,
          label: "Family members",
          value: "Mother, Father, Self / Others",
          action: "Manage"
        },
        {
          icon: Star,
          label: "Trusted caregivers",
          value: reports.length ? "Familiar caregivers appear after visits" : "Shown after first assigned visit",
          action: "View"
        },
        {
          icon: Repeat2,
          label: "Recurring care",
          value: "No recurring plan yet",
          action: "Set up"
        }
      ]
    },
    {
      title: "Care preferences",
      rows: [
        {
          icon: Sparkles,
          label: "Care preference",
          value: profile?.medicalNotes ?? serviceExperience.profilePreference,
          action: "Edit"
        },
        {
          icon: HeartPulse,
          label: "Medical readiness",
          value: `${details.allergies || profile?.allergies || "Allergies not set"} - ${details.mobility || "mobility pending"}`,
          action: "Review"
        },
        {
          icon: Pill,
          label: "Medication list",
          value:
            profile?.careRecipients?.[recipient.name]?.medicationList?.join(", ") ||
            "Add medicines and dosage timings",
          action: "Add"
        },
        {
          icon: Languages,
          label: "Preferred language",
          value: details.language || "Not set",
          action: "Edit"
        },
        {
          icon: MapPinned,
          label: "Care address",
          value: details.address || "Add address",
          action: "Edit"
        }
      ]
    },
    {
      title: "Payments and updates",
      rows: [
        {
          icon: WalletCards,
          label: "Payment methods",
          value: "UPI and cards",
          action: "Manage"
        },
        {
          icon: Users,
          label: "Family access",
          value: `${Object.keys(profile?.familyMembers || {}).length || 1} family member can monitor care`,
          action: "Invite"
        },
        {
          icon: MessageCircle,
          label: "WhatsApp updates",
          value: "Session updates enabled",
          action: "On"
        },
        {
          icon: Mic,
          label: "Voice summaries",
          value: "Caregiver voice notes enabled",
          action: "On"
        },
        {
          icon: Bell,
          label: "Notifications",
          value: "Family alerts enabled",
          action: "Manage"
        }
      ]
    },
    {
      title: "Support and safety",
      rows: [
        {
          icon: CircleHelp,
          label: "Help center",
          value: "Create ticket, complaint, or refund request",
          action: "Ready"
        },
        {
          icon: WalletCards,
          label: "Refund support",
          value: "Refund requests are reviewed by ops",
          action: "Request"
        },
        {
          icon: ShieldCheck,
          label: "Caregiver verification",
          value: "ID checked, trained, background verified",
          action: "Learn"
        },
        {
          icon: LockKeyhole,
          label: "Privacy and security",
          value: "Manage account and family access",
          action: "Manage"
        }
      ]
    }
  ];

  return (
    <section>
      <div className="rounded-[2rem] bg-white p-5 text-[#06130f]">
        <div className="flex items-start gap-4">
          <Avatar recipient={recipient} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-700">Care profile</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {details.fullName || profile?.elderName || `${recipient.displayName} Profile`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Age {details.age || "not set"} - {profile?.subscriptionPlan || "Premium"} care
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Verified care profile
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {details.mobility || "Mobility not set"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onSelectRecipient}
            className="rounded-full bg-[#06130f] px-4 py-3 text-sm font-semibold text-white"
          >
            Change recipient
          </button>
          <button
            onClick={onEditDetails}
            className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold"
          >
            Edit details
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <ProfileStat label="Plan" value={profile?.subscriptionPlan || "Premium"} />
        <ProfileStat label="Care score" value={reports.length ? "Ready" : "After visit"} />
        <ProfileStat label="Trusted visits" value={String(reports.length)} />
      </div>

      <FamilyPermissionsPanel profile={profile} onInviteFamily={onInviteFamily} />

      <section className="mt-6">
        <h3 className="mb-3 text-lg font-semibold">Care packages</h3>
        <div className="space-y-3">
          {Object.values(profile?.carePackages || {}).slice(0, 3).map((carePackage) => (
            <div key={carePackage.id} className="rounded-3xl bg-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{carePackage.name}</p>
                  <p className="mt-1 text-sm text-white/50">{carePackage.recommendedFor}</p>
                </div>
                <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-[#06130f]">
                  {carePackage.priceLabel}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {carePackage.included.map((item) => (
                  <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-6">
        {profileSections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-3 text-lg font-semibold">{section.title}</h3>
            <div className="space-y-3">
              {section.rows.map((row) => (
                <ProfileRow key={row.label} row={row} onAction={() => runProfileAction(row.label)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {profileActionMessage && (
        <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
          {profileActionMessage}
        </p>
      )}

      <button
        onClick={onSignOut}
        className="mt-6 w-full rounded-full bg-white/10 px-5 py-4 font-semibold"
      >
        Sign out
      </button>
    </section>
  );
}

export function FamilyPermissionsPanel({
  profile,
  onInviteFamily
}: {
  profile: CareProfile | null;
  onInviteFamily: () => void;
}) {
  const members = Object.values(profile?.familyMembers || {});
  const visibleMembers = members.length
    ? members
    : [
        {
          id: "primary-family",
          name: "Primary family member",
          relationship: "Family",
          phone: "Not shared",
          permissions: ["monitor", "alerts"] as Array<"monitor" | "alerts">,
          nriMode: true,
          updatedAt: 0
        }
      ];

  return (
    <section className="mt-6 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Family permissions</p>
          <h3 className="mt-1 text-2xl font-semibold">Shared care visibility</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Invite siblings or NRI family members with monitor-only, alerts, approval, or payment permissions.
          </p>
        </div>
        <button
          onClick={onInviteFamily}
          className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#06130f]"
        >
          Invite
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {visibleMembers.slice(0, 3).map((member) => (
          <div key={member.id} className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="mt-1 text-xs text-white/45">
                  {member.relationship} - {member.nriMode ? "NRI digest on" : "Local updates"}
                </p>
              </div>
              <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {member.permissions.join(", ")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white/10 p-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

export function ProfileRow({
  row,
  onAction
}: {
  row: { icon: LucideIcon; label: string; value: string; action?: string };
  onAction: () => void;
}) {
  const Icon = row.icon;

  return (
    <button
      onClick={onAction}
      className="flex w-full items-center gap-4 rounded-3xl bg-white/10 p-4 text-left transition hover:bg-white/15"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{row.label}</p>
        <p className="mt-1 text-sm text-white/50">{row.value}</p>
      </div>
      {row.action && (
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
          {row.action}
        </span>
      )}
    </button>
  );
}
