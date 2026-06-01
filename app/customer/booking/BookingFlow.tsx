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
import { GoogleAddressSelector } from "../../../components/GoogleAddressSelector";
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
import { MiniMetric } from "../home/Dashboard";

export function BookingFunnel({
  recipient,
  step,
  selectedNeed,
  selectedService,
  selectedDuration,
  selectedTime,
  selectedLocation,
  onClose,
  onNeed,
  onService,
  onDuration,
  onTime,
  onLocation,
  onBack,
  onConfirm,
  confirmBusy
}: {
  recipient: Recipient;
  step: BookingStep;
  selectedNeed: CareNeed;
  selectedService: string;
  selectedDuration: DurationOption;
  selectedTime: TimeOption;
  selectedLocation: LocationOption;
  onClose: () => void;
  onNeed: (need: CareNeed) => void;
  onService: (service: string) => void;
  onDuration: (duration: DurationOption) => void;
  onTime: (time: TimeOption) => void;
  onLocation: (location: LocationOption) => void;
  onBack: () => void;
  onConfirm: () => void;
  confirmBusy: boolean;
}) {
  const stepIndex = ["need", "service", "duration", "time", "location", "review"].indexOf(step);
  const stepLabel = `${stepIndex + 1} of 6`;
  const locationOptions: LocationOption[] = [
    {
      label: "Saved care address",
      detail: recipient.name ? "Use the address saved in care profile" : "Use saved address"
    },
    {
      label: "Hospital / clinic",
      detail: "Use this when care is needed at a medical location"
    },
    {
      label: "Lab / diagnostic center",
      detail: "Use this for tests or report collection"
    },
    {
      label: "Add another location",
      detail: "Enter a new address before final confirmation"
    }
  ];

  return (
    <div className="fixed inset-0 z-30 h-dvh overflow-y-auto overscroll-contain bg-[#06130f] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,.2),transparent_35%),linear-gradient(180deg,#06130f,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 py-5 pb-10">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="rounded-full bg-white/10 px-4 py-2 text-sm">
            Back
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm">
            Close
          </button>
        </div>
        <div className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar recipient={recipient} />
            <div>
              <p className="text-sm font-semibold text-emerald-100">Step {stepLabel}</p>
              <p className="mt-1 text-sm text-white/55">Care for {recipient.displayName}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2">
          {["Help", "Service", "Duration", "When", "Where", "Review"].map((label, index) => (
            <div key={label}>
              <div
                className={`h-1.5 rounded-full ${
                  index <= stepIndex ? "bg-emerald-300" : "bg-white/15"
                }`}
              />
              <p className="mt-2 text-xs text-white/45">{label}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "need" && (
            <FunnelScreen key="need">
              <h2 className="text-3xl font-semibold tracking-tight">
                What kind of support does {recipient.shortName} need today?
              </h2>
              <p className="mt-2 text-sm text-white/55">
                Choose the closest need. We will recommend the right service next.
              </p>
              <div className="mt-6 space-y-3">
                {careNeeds.map((need) => (
                  <NeedCard key={need.title} need={need} onClick={() => onNeed(need)} />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "service" && (
            <FunnelScreen key="service">
              <h2 className="text-3xl font-semibold tracking-tight">Recommended care options</h2>
              <p className="mt-2 text-sm text-white/55">{selectedNeed.recommendation}</p>
              <div className="mt-6 space-y-3">
                {selectedNeed.serviceGroups
                  ? selectedNeed.serviceGroups.map((group) => (
                      <div key={group.title} className="rounded-[1.5rem] bg-white/10 p-3">
                        <p className="font-semibold">{group.title}</p>
                        <p className="mt-1 text-sm text-white/50">{group.subtitle}</p>
                        <div className="mt-3 space-y-2">
                          {group.services.map((service) => (
                            <SelectRow
                              key={service}
                              active={selectedService === service}
                              title={service}
                              subtitle={`For ${recipient.shortName}`}
                              onClick={() => onService(service)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  : selectedNeed.services.map((service) => (
                      <SelectRow
                        key={service}
                        active={selectedService === service}
                        title={service}
                        subtitle={`For ${recipient.shortName}`}
                        onClick={() => onService(service)}
                      />
                    ))}
              </div>
            </FunnelScreen>
          )}

          {step === "duration" && (
            <FunnelScreen key="duration">
              <h2 className="text-3xl font-semibold tracking-tight">Choose duration</h2>
              <p className="mt-2 text-sm text-white/55">
                Availability and pricing are estimated before confirmation.
              </p>
              <div className="mt-6 space-y-3">
                {durationOptions.map((duration) => (
                  <SelectRow
                    key={duration.label}
                    active={selectedDuration.label === duration.label}
                    title={`${duration.label} - ${duration.price}`}
                    subtitle={
                      duration.recommended ? `${duration.note} - Recommended` : duration.note
                    }
                    onClick={() => onDuration(duration)}
                  />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "time" && (
            <FunnelScreen key="time">
              <h2 className="text-3xl font-semibold tracking-tight">When do you need care?</h2>
              <p className="mt-2 text-sm text-white/55">
                Choose when the caregiver should be arranged.
              </p>
              <div className="mt-6 space-y-3">
                {timeOptions.map((time) => (
                  <SelectRow
                    key={time.label}
                    active={selectedTime.label === time.label}
                    title={time.label}
                    subtitle={time.detail}
                    onClick={() => onTime(time)}
                  />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "location" && (
            <FunnelScreen key="location">
              <h2 className="text-3xl font-semibold tracking-tight">Where is care needed?</h2>
              <p className="mt-2 text-sm text-white/55">
                Confirm the place before we match a caregiver.
              </p>
              <div className="mt-6 space-y-3">
                <GoogleAddressSelector
                  selectedAddress={selectedLocation}
                  onSelect={(address) =>
                    onLocation({
                      label: address.label,
                      detail: address.detail,
                      latitude: address.latitude,
                      longitude: address.longitude,
                      placeId: address.placeId
                    })
                  }
                />
                {locationOptions.map((location) => (
                  <SelectRow
                    key={location.label}
                    active={selectedLocation.label === location.label}
                    title={location.label}
                    subtitle={location.detail}
                    onClick={() => onLocation(location)}
                  />
                ))}
              </div>
            </FunnelScreen>
          )}

          {step === "review" && (
            <FunnelScreen key="review">
              <Card className="rounded-[2rem] border-0 bg-white p-5 text-[#06130f]">
                <h2 className="text-3xl font-semibold tracking-tight">Review booking</h2>
                <div className="mt-5 space-y-3">
                  <MiniMetric label="Care for" value={recipient.displayName} />
                  <MiniMetric label="Service" value={selectedService} />
                  <MiniMetric label="Duration" value={selectedDuration.label} />
                  <MiniMetric label="When" value={selectedTime.label} />
                  <MiniMetric label="Where" value={selectedLocation.label} />
                </div>
                <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Care estimate</span>
                    <span className="font-semibold">{selectedDuration.price}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-slate-500">Coordination fee</span>
                    <span className="font-semibold">Included</span>
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between gap-4">
                    <span className="font-semibold">Estimated total</span>
                    <span className="font-semibold">{selectedDuration.price}</span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-emerald-800">
                  {[
                    "Verified caregivers",
                    "Family updates included",
                    "Support available",
                    "Trained attendants"
                  ].map((item) => (
                    <div key={item} className="rounded-2xl bg-emerald-50 p-3">
                      <Check className="mb-1 h-4 w-4" />
                      {item}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={onConfirm}
                  disabled={confirmBusy}
                  className="mt-5 w-full bg-[#06130f] px-5 py-4 text-white hover:bg-[#10241d] disabled:cursor-wait disabled:bg-slate-400"
                >
                  {confirmBusy ? "Preparing payment..." : "Confirm Care"}
                </Button>
              </Card>
            </FunnelScreen>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function FunnelScreen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-7"
    >
      {children}
    </motion.div>
  );
}

export function NeedCard({ need, onClick }: { need: CareNeed; onClick: () => void }) {
  const Icon = need.icon;

  return (
    <Button
      onClick={onClick}
      variant="default"
      className="h-auto w-full justify-start gap-4 rounded-[1.5rem] bg-white p-4 text-left text-[#06130f] hover:bg-white/95"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
        <Icon className="h-6 w-6 text-emerald-800" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{need.title}</p>
        <p className="mt-1 text-sm text-slate-500">{need.subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-400" />
    </Button>
  );
}

export function SelectRow({
  active,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      variant="calm"
      className={`h-auto w-full justify-between rounded-3xl p-4 text-left transition ${
        active ? "bg-white text-[#06130f]" : "bg-white/10 text-white"
      }`}
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className={`mt-1 text-sm ${active ? "text-slate-500" : "text-white/50"}`}>{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 opacity-60" />
    </Button>
  );
}

export function CareOnWay({ recipient }: { recipient: Recipient }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#06130f] p-6 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-300 text-[#06130f]">
          <Check className="h-10 w-10" />
        </div>
        <h2 className="mt-6 text-4xl font-semibold tracking-tight">Care is on the way</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          We have sent {recipient.shortName}&apos;s request to nearby verified caregivers. The Care
          screen will open automatically with assignment, ETA, OTP, and live updates.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-xs text-white/65">
          {["Matching", "ETA", "OTP"].map((item) => (
            <div key={item} className="rounded-2xl bg-white/10 px-3 py-3">
              {item}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
