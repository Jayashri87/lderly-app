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

export function JourneyExperience({
  recipient,
  journey,
  booking,
  onImmediate,
  onCompletePayment,
  onVerifyCompletion,
  onCancelCare,
  onRateCare
}: {
  recipient: Recipient;
  journey: CareJourney | null;
  booking: CareBooking | null;
  onImmediate: () => void;
  onCompletePayment: () => void;
  onVerifyCompletion: () => void;
  onCancelCare: () => void;
  onRateCare: () => void;
}) {
  const [liveNow, setLiveNow] = useState(() => new Date().getTime());
  const bookingStatus = booking?.status ?? "none";
  const paymentPending = Boolean(
    booking &&
      booking.status !== "none" &&
      !["paid", "refunded"].includes(booking.payment?.status || "pending")
  );
  const status =
    journey?.status ??
    (bookingStatus === "none" || bookingStatus === "cancelled"
      ? "idle"
      : bookingStatus === "searching"
        ? "requested"
        : bookingStatus === "payment_settled" || bookingStatus === "report_generated"
          ? "completed"
        : bookingStatus);
  const activeMapJourney: CareJourney | null =
    journey ||
    (booking && booking.status !== "none"
      ? {
          id: booking.id,
          status:
            status === "idle" || status === "escalated"
              ? "requested"
              : status === "completed"
                ? "completed"
                : status,
          summary: booking.lifecycle.currentStep,
          serviceType: booking.serviceType,
          eta: booking.tracking?.etaMinutes || 0,
          customerId: booking.customerId,
          customerName: booking.customerName,
          caretakerId: booking.caretakerId,
          caretakerName: booking.caretakerName,
          priority: booking.matching.priority,
          destinationLabel: booking.tracking?.destinationLabel || "Care location",
          customerLocation: booking.tracking?.customerLocation || {
            lat: 12.9716,
            lng: 77.5946
          },
          caretakerLocation: booking.tracking?.caretakerLocation || {
            lat: 12.985,
            lng: 77.61
          },
          routePolyline: booking.tracking?.routePolyline,
          routePath: booking.tracking?.routePath,
          routeDistanceMeters: booking.tracking?.routeDistanceMeters,
          routeDurationSeconds: booking.tracking?.routeDurationSeconds,
          routeSource: booking.tracking?.routeSource,
          routeUpdatedAt: booking.tracking?.routeUpdatedAt,
          lastLocationAt: booking.tracking?.lastLocationAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          timeline: booking.timeline
        }
      : null);
  const activeService = cleanServiceName(journey?.serviceType || booking?.serviceType);
  const hasActiveService =
    (journey && journey.status !== "idle") || (booking && booking.status !== "none");
  const careStatus = careStatusFor({ booking, journey });
  const serviceExperience = serviceExperienceFor(activeService);
  const activeIndex =
    bookingStatus === "in_progress"
      ? 4
      : status === "completed"
      ? 5
      : status === "arrived"
        ? 3
        : status === "en_route"
          ? 2
          : status === "assigned" || status === "accepted"
            ? 1
            : 0;
  const currentStep = journeySteps[activeIndex];
  const nextStep = journeySteps[Math.min(activeIndex + 1, journeySteps.length - 1)];
  useEffect(() => {
    const interval = window.setInterval(() => setLiveNow(new Date().getTime()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const locationAgeMinutes = activeMapJourney?.lastLocationAt && liveNow
    ? Math.max(0, Math.round((liveNow - activeMapJourney.lastLocationAt) / 60000))
    : null;
  const liveTrackingState =
    status === "in_progress"
      ? "live"
      : status === "arrived"
      ? "arrived"
      : status === "en_route" && (activeMapJourney?.eta ?? 0) > 0 && (activeMapJourney?.eta ?? 0) <= 3
        ? "arriving_soon"
        : ["accepted", "en_route"].includes(status)
          ? "live"
          : "waiting";
  const liveTrackingCopy =
    status === "in_progress"
      ? "Care has started. Live updates will appear as tasks are completed."
      : liveTrackingState === "arrived"
      ? "Caregiver has reached the care location."
      : liveTrackingState === "arriving_soon"
        ? "Arriving soon. Keep the service OTP ready."
        : liveTrackingState === "live"
          ? "Live location is updating from the caregiver app."
          : "Tracking begins as soon as your caregiver is confirmed.";
  const freshnessLabel =
    locationAgeMinutes === null
      ? "Location pending"
      : locationAgeMinutes <= 0
        ? "Updated just now"
        : `Updated ${locationAgeMinutes} min ago`;
  const canCancelRequest = ["searching", "assigned", "accepted"].includes(bookingStatus);
  const canRateCare =
    ["payment_settled", "report_generated"].includes(bookingStatus) && !booking?.rating?.score;

  return (
    <section>
      {paymentPending && booking ? (
        <PaymentPendingCare
          booking={booking}
          recipient={recipient}
          onCompletePayment={onCompletePayment}
        />
      ) : null}

      {!hasActiveService && (
        <section className="rounded-[2rem] bg-white p-5 text-[#06130f]">
          <p className="text-sm font-medium text-emerald-700">Care</p>
          <h2 className="mt-2 text-2xl font-semibold">No active care yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Once you confirm a service, live updates for that exact service will appear here.
          </p>
        </section>
      )}

      {hasActiveService && !paymentPending && (
        <>
      <EmergencyResponseCard
        active={booking?.matching?.priority === "critical" || booking?.sla?.status === "breached"}
        title={
          booking?.matching?.priority === "critical" || booking?.sla?.status === "breached"
            ? "Emergency escalation is being coordinated"
            : "Emergency path is ready if needed"
        }
        description={
          booking?.matching?.priority === "critical" || booking?.sla?.status === "breached"
            ? "Ops is reviewing the active care state and keeping the response chain visible."
            : "Immediate Assistance stays one tap away with family, ops, ambulance, and hospital routing."
        }
        steps={[
          { label: "Family alert channel ready", status: "done" },
          {
            label:
              booking?.matching?.priority === "critical" || booking?.sla?.status === "breached"
                ? "Ops team reviewing"
                : "Ops team standing by",
            status: booking?.matching?.priority === "critical" || booking?.sla?.status === "breached" ? "active" : "next"
          },
          { label: "Responder route available", status: "next" },
          { label: "Hospital fallback visible", status: "next" }
        ]}
        className="mb-5"
      />
      <div className="premium-card rounded-[2rem] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">Live care</p>
            <h2 className="premium-title mt-2 text-2xl font-semibold">
              {status === "idle" ? "No active care" : careStatus}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeService} - ETA {activeMapJourney?.eta ?? 8} mins - {journey?.caretakerName || booking?.caretakerName || "Best caregiver nearby"}
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-emerald-700" />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-100 p-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
            {(journey?.caretakerName || booking?.caretakerName || "?").charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {journey?.caretakerName || booking?.caretakerName || "Caregiver being matched"}
            </p>
            <p className="text-sm text-slate-500">
              {(journey?.caretakerName || booking?.caretakerName)
                ? "Verified caregiver - trained - trust profile updating"
                : "Verified caregiver details appear after assignment"}
            </p>
            {(journey?.caretakerName || booking?.caretakerName) ? (
              <p className="mt-1 text-xs text-emerald-700">
                Familiarity and visit history will update after each completed visit.
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">
                We will show name, photo, ETA, and trust badges after assignment.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              trackProductEvent("customer_caregiver_message_clicked", {
                bookingId: booking?.id || journey?.id || "",
                service: activeService
              });
              window.open("https://wa.me/919916960524?text=I%20need%20an%20update%20on%20my%20LDERLY%20care%20visit", "_blank");
            }}
            aria-label="Message caregiver"
            className="rounded-full bg-white p-3"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              trackProductEvent("customer_caregiver_call_clicked", {
                bookingId: booking?.id || journey?.id || "",
                service: activeService
              });
              window.location.href = "tel:+919916960524";
            }}
            aria-label="Call caregiver"
            className="rounded-full bg-white p-3"
          >
            <Phone className="h-5 w-5" />
          </button>
        </div>
      </div>

      <LiveEtaCard
        eta={activeMapJourney?.eta ?? 8}
        currentStep={currentStep}
        nextStep={nextStep}
        activeIndex={activeIndex}
        liveTrackingState={liveTrackingState}
        liveTrackingCopy={liveTrackingCopy}
        freshnessLabel={freshnessLabel}
      />

      <CustomerCareFunnel booking={booking} status={status} />

      <section className="premium-card mt-5 rounded-[1.5rem] p-4">
        <p className="text-sm font-semibold text-emerald-700">Care security</p>
        {booking?.status === "arrived" ? (
          <>
            <h3 className="mt-1 text-2xl font-semibold">Share OTP after caregiver arrives</h3>
            <div className="mt-3 rounded-3xl bg-slate-100 px-5 py-4 text-center text-3xl font-semibold tracking-[0.35em]">
              {booking?.serviceStart?.otp || "------"}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              This OTP starts the visit. Share it only after the caregiver is at the care location.
            </p>
          </>
        ) : booking?.status === "completed" && booking?.completion?.paymentReleaseStatus === "awaiting_customer" ? (
          <>
            <h3 className="mt-1 text-2xl font-semibold">Confirm the visit went well</h3>
            <p className="mt-2 text-sm text-slate-500">
              Review the visit notes, medicine/vitals, and family handover before confirming.
            </p>
            <button
              onClick={onVerifyCompletion}
              className="mt-4 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
            >
              Confirm visit
            </button>
          </>
        ) : booking?.status === "payment_settled" ? (
          <>
            <h3 className="mt-1 text-2xl font-semibold">Visit confirmed</h3>
            <p className="mt-2 text-sm text-slate-500">
              Thank you. Your care summary is ready for family review.
            </p>
            {canRateCare ? (
              <button
                onClick={onRateCare}
                className="mt-4 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
              >
                Rate this care 5/5
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            OTP and visit confirmation controls appear at the right moment in the care journey.
          </p>
        )}
      </section>

      {canCancelRequest ? (
        <button
          onClick={onCancelCare}
          className="mt-4 w-full rounded-full border border-white/15 bg-white/10 px-5 py-4 text-sm font-semibold text-white"
        >
          Cancel this care request
        </button>
      ) : null}

      <div className="mt-5">
        <LiveMap journey={activeMapJourney} />
      </div>

      <section className="glass-panel mt-6 rounded-[1.5rem] p-4">
        <p className="font-semibold">Care progress</p>
        <div className="mt-4 grid grid-cols-6 gap-1">
          {journeySteps.map((step, index) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-colors duration-500 ${
                index < activeIndex
                  ? "bg-emerald-300"
                  : index === activeIndex
                    ? "animate-pulse bg-amber-300"
                    : "bg-white/15"
              }`}
              title={step}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/45">Now</p>
            <p className="mt-1 font-semibold">{currentStep}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-xs text-white/45">Next</p>
            <p className="mt-1 font-semibold">{nextStep}</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <p className="text-xl font-semibold">{serviceExperience.feedTitle}</p>
        <div className="mt-4 space-y-3">
          {serviceExperience.feed.slice(0, 3).map((item, index) => (
            <div key={item} className="rounded-3xl bg-white/10 p-4">
              <div className="flex items-start gap-3">
                {item.includes("Voice") ? (
                  <Mic className="mt-0.5 h-5 w-5 text-emerald-200" />
                ) : (
                  <Check className="mt-0.5 h-5 w-5 text-emerald-200" />
                )}
                <div>
                  <p className="text-sm">
                    {item.replace("Mom", recipient.shortName)}
                  </p>
                  <p className="mt-1 text-xs text-white/40">{index + 3} mins ago</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={onImmediate}
        className="mt-6 w-full rounded-full bg-red-500 px-5 py-4 font-semibold shadow-xl shadow-red-500/20"
      >
        Immediate Assistance
      </button>
        </>
      )}
    </section>
  );
}

export function PaymentPendingCare({
  booking,
  recipient,
  onCompletePayment
}: {
  booking: CareBooking;
  recipient: Recipient;
  onCompletePayment: () => void;
}) {
  return (
    <section className="premium-card rounded-[2rem] p-5">
      <p className="text-sm font-semibold text-amber-700">Payment pending</p>
      <h2 className="mt-2 text-2xl font-semibold">Complete payment to start care</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Your request for {recipient.shortName} is saved. Payment verification unlocks live
        tracking, OTP start, family verification, and caregiver payment release.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-xs text-slate-500">Service</p>
          <p className="mt-1 font-semibold">{cleanServiceName(booking.serviceType)}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3">
          <p className="text-xs text-slate-500">Amount</p>
          <p className="mt-1 font-semibold">{booking.payment.estimatedTotal}</p>
        </div>
      </div>
      <button
        onClick={onCompletePayment}
        className="motion-lift mt-5 w-full rounded-full bg-[#06130f] px-5 py-4 font-semibold text-white"
      >
        Complete payment
      </button>
      <button
        onClick={() =>
          window.open(
            "https://wa.me/919916960524?text=I%20need%20help%20completing%20my%20LDERLY%20payment",
            "_blank"
          )
        }
        className="mt-3 w-full rounded-full bg-slate-100 px-5 py-4 font-semibold"
      >
        Contact LDERLY
      </button>
    </section>
  );
}

export function PaymentTermsModal({
  booking,
  onCancel,
  onAgree
}: {
  booking: CareBooking;
  onCancel: () => void;
  onAgree: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="grid max-h-[92dvh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="min-h-0 text-left">
          <div className="flex items-start gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Payment agreement
              </p>
              <DialogTitle className="mt-1">
                Review before payment
              </DialogTitle>
              <DialogDescription className="mt-2">
                You are paying {booking.payment.estimatedTotal} for {cleanServiceName(booking.serviceType)}.
                Care dispatch starts only after payment is verified.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain px-5 pb-4 pt-2 text-sm leading-6 text-slate-600 sm:px-6">
          {[
            "Caregiver assignment, ETA, and visit tracking start after successful payment.",
            "Cancellation and refund handling follows the LDERLY refund policy and depends on dispatch status.",
            "Service starts only after customer OTP verification at the care location.",
            "Emergency assistance coordinates support but does not replace hospital or ambulance emergency services.",
            "Visit proof, caregiver notes, and payment records may be used for service verification and support."
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
              <Check className="mt-0.5 shrink-0 text-emerald-600" size={16} />
              <p>{item}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 bg-white/95 p-5 pt-4 shadow-[0_-18px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 sm:pt-4">
          <div className="rounded-2xl border border-slate-200 p-3 text-sm leading-6 text-slate-700">
            <span>
              By continuing to payment, I agree to the{" "}
              <Link href="/legal/terms" className="font-semibold text-[#06130f] underline">
                Terms
              </Link>
              ,{" "}
              <Link href="/legal/refunds" className="font-semibold text-[#06130f] underline">
                Refund Policy
              </Link>
              , and payment authorization for this care request.
            </span>
          </div>

          <DialogFooter className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Button
              onClick={onCancel}
              variant="default"
              className="w-full bg-slate-100 px-4 py-4 text-slate-700 hover:bg-slate-200"
            >
              Not now
            </Button>
            <Button
              onClick={onAgree}
              className="w-full bg-[#06130f] px-4 py-4 text-white hover:bg-[#10241d]"
            >
              I agree & pay
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LiveEtaCard({
  eta,
  currentStep,
  nextStep,
  activeIndex,
  liveTrackingState,
  liveTrackingCopy,
  freshnessLabel
}: {
  eta: number;
  currentStep: string;
  nextStep: string;
  activeIndex: number;
  liveTrackingState: "arrived" | "arriving_soon" | "live" | "waiting";
  liveTrackingCopy: string;
  freshnessLabel: string;
}) {
  const isArrivingSoon = liveTrackingState === "arriving_soon";
  const isLive = liveTrackingState === "live" || isArrivingSoon;

  return (
    <section
      className={`mt-5 rounded-[1.5rem] border p-4 transition-colors ${
        isArrivingSoon
          ? "border-amber-200/30 bg-amber-200/15"
          : "border-emerald-200/15 bg-emerald-200/10"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? "animate-ping bg-emerald-300" : "bg-white/40"
              }`}
            />
            {isArrivingSoon ? "Arriving soon" : "Live ETA"}
          </p>
          <h3 className="mt-1 text-3xl font-semibold">
            {liveTrackingState === "arrived" ? "Arrived" : `${eta || 8} mins`}
          </h3>
          <p className="mt-1 text-sm text-white/60">{liveTrackingCopy}</p>
          <p className="mt-1 text-xs text-white/45">{freshnessLabel}</p>
        </div>
        <div
          className={`relative h-14 w-14 rounded-full ${
            isArrivingSoon ? "bg-amber-300/15" : "bg-emerald-300/15"
          }`}
        >
          <span
            className={`absolute inset-2 animate-ping rounded-full ${
              isArrivingSoon ? "bg-amber-300/25" : "bg-emerald-300/20"
            }`}
          />
          <span
            className={`absolute inset-5 rounded-full ${
              isArrivingSoon ? "bg-amber-200" : "bg-emerald-200"
            }`}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-white/45">Now</p>
          <p className="mt-1 font-semibold">{currentStep}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-white/45">Next</p>
          <p className="mt-1 font-semibold">{nextStep}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(16, ((activeIndex + 1) / journeySteps.length) * 100)}%` }}
          className="h-full rounded-full bg-emerald-300"
        />
      </div>
    </section>
  );
}

export function CustomerCareFunnel({
  booking,
  status
}: {
  booking: CareBooking | null;
  status: CareJourney["status"];
}) {
  const paymentReleased =
    booking?.status === "payment_settled" ||
    booking?.completion?.paymentReleaseStatus === "released";
  const steps = [
    {
      label: "Request sent",
      detail: "We are finding the right caregiver",
      done: Boolean(booking && booking.status !== "none"),
      active: status === "requested"
    },
    {
      label: "Caregiver confirmed",
      detail: booking?.caretakerName || "Our care team is coordinating",
      done: ["accepted", "en_route", "arrived", "in_progress", "completed"].includes(status),
      active: status === "assigned"
    },
    {
      label: "Track arrival",
      detail: `${booking?.tracking?.etaMinutes ?? 0} min ETA`,
      done: ["arrived", "in_progress", "completed"].includes(status),
      active: status === "accepted" || status === "en_route"
    },
    {
      label: "Share OTP",
      detail: booking?.status === "arrived" ? "OTP visible below" : "Shown only after arrival",
      done: ["in_progress", "completed"].includes(status),
      active: status === "arrived"
    },
    {
      label: "Visit complete",
      detail:
        booking?.completion?.paymentReleaseStatus === "awaiting_customer"
          ? "Please confirm the visit"
          : "Care summary will be ready",
      done: paymentReleased,
      active:
        status === "in_progress" ||
        (booking?.status === "completed" &&
          booking.completion?.paymentReleaseStatus === "awaiting_customer")
    }
  ];

  return (
    <section className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-100">Care progress</p>
          <h3 className="mt-1 text-2xl font-semibold">What is happening now</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">
            We keep this updated as your caregiver is assigned, arrives, starts care, and completes the visit.
          </p>
        </div>
        <Badge variant="trust">Live</Badge>
      </div>
      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-emerald-300 text-[#06130f]"
                  : step.active
                    ? "bg-amber-300 text-[#06130f]"
                    : "bg-white/10 text-white/40"
              }`}
            >
              {step.done ? <Check className="h-4 w-4" /> : step.active ? "!" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white/85">{step.label}</p>
              <p className="mt-0.5 text-xs text-white/45">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
