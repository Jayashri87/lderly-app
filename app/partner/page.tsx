"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  MapPinned,
  Navigation,
  ShieldCheck
} from "lucide-react";
import LiveMap from "../../components/LiveMap";
import { AuthService, SessionUser } from "../../services/authService";
import { BookingService, CareBooking } from "../../services/bookingService";
import { CaretakerService } from "../../services/caretakerService";
import { HealthService, HealthSnapshot } from "../../services/healthService";
import { JourneyService, CareJourney } from "../../services/journeyService";
import { ReportService } from "../../services/reportService";
import { trackProductEvent } from "../../services/productAnalytics";

type GpsStatus = "idle" | "requesting" | "tracking" | "simulated" | "blocked" | "unsupported" | "error";

export default function PartnerApp() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [journey, setJourney] = useState<CareJourney | null>(null);
  const [booking, setBooking] = useState<CareBooking | null>(null);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [caretakerUsername, setCaretakerUsername] = useState("");
  const [caretakerPassword, setCaretakerPassword] = useState("");
  const [caretakerError, setCaretakerError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [customerStartOtp, setCustomerStartOtp] = useState("");
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsMessage, setGpsMessage] = useState("Live GPS has not started.");
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [lastGpsAt, setLastGpsAt] = useState<number | null>(null);

  useEffect(() => {
    return AuthService.subscribe((user) => setSession(user));
  }, []);

  useEffect(() => {
    if (!session || session.role !== "caretaker") {
      return;
    }

    const unsubscribers = [
      JourneyService.subscribe(session, setJourney),
      BookingService.subscribe(session, setBooking),
      HealthService.subscribe(session, setHealth)
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [session]);

  const enterPartnerApp = async () => {
    setCaretakerError("");
    const response = await fetch("/api/auth/caretaker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: caretakerUsername,
        password: caretakerPassword
      })
    });

    if (!response.ok) {
      setCaretakerError("Check the caretaker username and password.");
      return;
    }

    const partner = await AuthService.continueAs("caretaker");
    trackProductEvent("caretaker_login_success", {
      source: "partner_app"
    });
    setSession(partner);
  };

  const bookingIsFreshestActiveCare =
    Boolean(booking && booking.status !== "none") &&
    (!journey || journey.status === "idle" || (booking?.updatedAt ?? 0) >= journey.updatedAt);
  const activeJourney = bookingIsFreshestActiveCare ? null : journey;
  const activeBooking = booking;
  const isJourneyAssignment = Boolean(activeJourney && activeJourney.status !== "idle");
  const isBookingAssignment = Boolean(activeBooking && activeBooking.status !== "none");
  const bookingMapJourney: CareJourney | null =
    activeBooking && activeBooking.status !== "none"
      ? {
          id: activeBooking.id,
          status:
            activeBooking.status === "en_route"
              ? "en_route"
              : activeBooking.status === "arrived"
                ? "arrived"
                : activeBooking.status === "completed"
                  ? "completed"
                  : activeBooking.status === "cancelled"
                    ? "completed"
                    : activeBooking.status === "assigned"
                      ? "assigned"
                      : activeBooking.status === "accepted"
                        ? "accepted"
                        : "requested",
          summary: activeBooking.lifecycle.currentStep,
          serviceType: activeBooking.serviceType,
          eta: activeBooking.tracking?.etaMinutes || 0,
          customerId: activeBooking.customerId,
          customerName: activeBooking.customerName,
          caretakerId: activeBooking.caretakerId,
          caretakerName: activeBooking.caretakerName,
          priority: activeBooking.matching.priority,
          destinationLabel: activeBooking.tracking?.destinationLabel || "Care location",
          customerLocation: activeBooking.tracking?.customerLocation || {
            lat: 12.9716,
            lng: 77.5946
          },
          caretakerLocation: activeBooking.tracking?.caretakerLocation || {
            lat: 12.985,
            lng: 77.61
          },
          createdAt: activeBooking.createdAt,
          updatedAt: activeBooking.updatedAt,
          timeline: activeBooking.timeline
        }
      : activeJourney;

  const completeBooking = () => {
    trackProductEvent("caretaker_session_completed", {
      bookingId: activeBooking?.id,
      service: activeBooking?.serviceType,
      source: "booking"
    });
    BookingService.updateStatus("completed");
    ReportService.createFromBooking(activeBooking, health);
  };

  const completeJourney = () => {
    trackProductEvent("caretaker_session_completed", {
      bookingId: activeJourney?.id,
      service: activeJourney?.serviceType,
      source: "journey"
    });
    JourneyService.updateStatus("completed");
    ReportService.createFromJourney(activeJourney, health);
  };

  const trackCaretakerAction = (action: string) => {
    trackProductEvent(`caretaker_${action}`, {
      bookingId: activeBooking?.id || activeJourney?.id || "",
      service: activeBooking?.serviceType || activeJourney?.serviceType || "none",
      bookingStatus: activeBooking?.status || activeJourney?.status || "idle",
      hasAssignment: isBookingAssignment || isJourneyAssignment
    });
  };
  const hasActiveAssignment = isBookingAssignment || isJourneyAssignment;
  const activeTrackingBookingId = activeBooking?.id;
  const bookingStatus = activeBooking?.status || "none";
  const journeyStatus = activeJourney?.status || "idle";
  const canAcceptCare =
    isJourneyAssignment || bookingStatus === "searching" || bookingStatus === "assigned";
  const canGoEnRoute =
    isJourneyAssignment || bookingStatus === "accepted";
  const canMarkArrived =
    isJourneyAssignment || bookingStatus === "en_route";
  const canStartVisit =
    isJourneyAssignment || (bookingStatus === "arrived" && customerStartOtp.trim().length >= 4);
  const canCompleteVisit =
    isJourneyAssignment
      ? journeyStatus === "arrived"
      : bookingStatus === "in_progress";
  const runAssignmentAction = (label: string, action: () => void) => {
    setActionMessage("");

    if (!hasActiveAssignment) {
      setActionMessage("No active assignment yet. New bookings will appear here when ops assigns care.");
      return;
    }

    action();
    setActionMessage(`${label} sent to LDERLY ops and family timeline.`);
  };

  const stopGpsWatch = () => {
    if (gpsWatchId === null || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.clearWatch(gpsWatchId);
    setGpsWatchId(null);
    setGpsStatus("idle");
    setGpsMessage("Live GPS stopped. Tap Start live GPS before leaving for the next visit.");
  };

  const sendDevicePosition = async (position: GeolocationPosition) => {
    if (!session) {
      return;
    }

    try {
      await CaretakerService.sendLocation(session.uid, activeTrackingBookingId, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyMeters: Math.round(position.coords.accuracy),
        capturedAt: position.timestamp,
        source: "device"
      });
      setLastGpsAt(Date.now());
      setGpsStatus("tracking");
      setGpsMessage(
        `Live GPS updated with ${Math.round(position.coords.accuracy)}m accuracy.`
      );
      trackCaretakerAction("device_gps_updated");
    } catch {
      setGpsStatus("error");
      setGpsMessage("GPS was captured, but LDERLY could not save it. Please try again.");
    }
  };

  const sendSimulatedLocationFallback = async () => {
    if (!session) {
      return;
    }

    try {
      await CaretakerService.updateLocation(session.uid, activeTrackingBookingId);
      setLastGpsAt(Date.now());
      setGpsStatus("simulated");
      setGpsMessage("Device GPS was not available, so a demo movement update was sent.");
      trackCaretakerAction("simulated_gps_updated");
    } catch {
      setGpsStatus("error");
      setGpsMessage("Location update could not be sent. Check network and try again.");
    }
  };

  const updateGpsOnce = () => {
    if (!session || !hasActiveAssignment) {
      setGpsMessage("No active assignment yet. GPS starts after care is assigned.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unsupported");
      setGpsMessage("This browser does not support device GPS. Sending a demo fallback.");
      sendSimulatedLocationFallback();
      return;
    }

    setGpsStatus("requesting");
    setGpsMessage("Requesting location permission from this device.");
    navigator.geolocation.getCurrentPosition(
      sendDevicePosition,
      () => {
        setGpsStatus("blocked");
        setGpsMessage("GPS permission was blocked. Sending a demo fallback for testing.");
        sendSimulatedLocationFallback();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
      }
    );
  };

  const startGpsWatch = () => {
    if (!session || !hasActiveAssignment) {
      setGpsMessage("No active assignment yet. Live GPS starts after care is assigned.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unsupported");
      setGpsMessage("This browser does not support live GPS. Sending a demo fallback.");
      sendSimulatedLocationFallback();
      return;
    }

    if (gpsWatchId !== null) {
      setGpsMessage("Live GPS is already running.");
      return;
    }

    setGpsStatus("requesting");
    setGpsMessage("Starting live GPS. Keep this page open while travelling.");
    const watchId = navigator.geolocation.watchPosition(
      sendDevicePosition,
      () => {
        setGpsStatus("blocked");
        setGpsMessage("Live GPS permission was blocked. Sending a demo fallback.");
        sendSimulatedLocationFallback();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
      }
    );
    setGpsWatchId(watchId);
  };

  useEffect(() => {
    return () => {
      if (gpsWatchId !== null && typeof navigator !== "undefined") {
        navigator.geolocation?.clearWatch(gpsWatchId);
      }
    };
  }, [gpsWatchId]);

  if (!session || session.role !== "caretaker") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080b10] px-5 text-white">
        <section className="w-full max-w-md rounded-[2rem] bg-white p-6 text-[#080b10]">
          <p className="text-sm font-semibold text-emerald-700">LDERLY Partner</p>
          <h1 className="mt-3 text-3xl font-semibold">Caregiver operations</h1>
          <p className="mt-2 text-sm text-slate-500">
            Accept bookings, navigate, update sessions, and complete reports.
          </p>
          <div className="mt-6 space-y-3">
            <input
              autoComplete="username"
              value={caretakerUsername}
              onChange={(event) => setCaretakerUsername(event.target.value)}
              placeholder="Caretaker username"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
            <input
              autoComplete="current-password"
              type="password"
              value={caretakerPassword}
              onChange={(event) => setCaretakerPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          {caretakerError && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {caretakerError}
            </p>
          )}
          <button
            onClick={enterPartnerApp}
            className="mt-4 w-full rounded-full bg-[#080b10] px-5 py-4 font-semibold text-white"
          >
            Enter Partner App
          </button>
          <button
            onClick={() => router.push("/")}
            className="mt-3 w-full rounded-full bg-slate-100 px-5 py-4 font-semibold"
          >
            Customer Home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">
              LDERLY Partner
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Today</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold">
              KYC ready
            </div>
            <div className="rounded-full bg-emerald-300 px-3 py-2 text-sm font-semibold text-[#080b10]">
              Online
            </div>
            <button
              onClick={() => {
                trackCaretakerAction("availability_offline");
                CaretakerService.setAvailability(session.uid, "offline", false);
              }}
              className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"
            >
              Go offline
            </button>
            <button
              onClick={async () => {
                await AuthService.signOut();
                setSession(null);
                router.replace("/partner");
              }}
              className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-[2rem] bg-white p-5 text-[#080b10]">
          <p className="text-sm font-semibold text-emerald-700">Current assignment</p>
          <h2 className="mt-2 text-2xl font-semibold">
            {isJourneyAssignment
              ? activeJourney?.serviceType
              : isBookingAssignment
                ? activeBooking?.serviceType
                : "No active booking"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {activeJourney?.customerName ||
              activeBooking?.customerName ||
              "Assignments will appear here"}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric
              icon={Clock}
              label="ETA"
              value={`${bookingMapJourney?.eta || activeJourney?.eta || 8}m`}
            />
            <Metric icon={ShieldCheck} label="Rating" value="4.9" />
            <Metric
              icon={MapPinned}
              label="SLA"
              value={activeBooking?.sla?.status === "breached" ? "Breach" : "On time"}
            />
          </div>
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-emerald-200/15 bg-emerald-200/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-100">Visit readiness</p>
              <h2 className="mt-1 text-2xl font-semibold">Next best action is clear</h2>
              <p className="mt-1 text-sm text-white/50">
                Large actions below keep the visit workflow fast, calm, and audit-ready.
              </p>
            </div>
            <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-[#080b10]">
              96% reliable
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/60">
            <div className="rounded-2xl bg-white/10 p-3">KYC verified</div>
            <div className="rounded-2xl bg-white/10 p-3">Training active</div>
            <div className="rounded-2xl bg-white/10 p-3">SLA tracked</div>
          </div>
        </section>

        <section className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">Uber-style job flow</p>
          <h2 className="mt-1 text-xl font-semibold">
            Accept request, travel, verify OTP, complete visit
          </h2>
          <p className="mt-1 text-sm text-white/55">
            The customer shares the start OTP only after you reach the care location.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-1 text-[11px] text-white/60">
            {["Offer", "Accept", "OTP Start", "Family Verify"].map((step) => (
              <div key={step} className="rounded-full bg-white/10 px-2 py-2 text-center">
                {step}
              </div>
            ))}
          </div>
          <input
            value={customerStartOtp}
            onChange={(event) => setCustomerStartOtp(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter customer start OTP"
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-center text-lg font-semibold tracking-[0.28em] text-[#080b10] outline-none"
          />
        </section>

        <div className="mt-5">
          <LiveMap journey={bookingMapJourney} />
        </div>

        <section className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-100">Live GPS</p>
              <h2 className="mt-1 text-xl font-semibold">
                {gpsStatus === "tracking"
                  ? "Sharing real location"
                  : gpsStatus === "requesting"
                    ? "Waiting for device permission"
                    : gpsStatus === "simulated"
                      ? "Demo movement active"
                      : "Ready before travel"}
              </h2>
              <p className="mt-1 text-sm text-white/55">{gpsMessage}</p>
            </div>
            <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold capitalize text-[#080b10]">
              {gpsStatus}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button
              onClick={gpsWatchId === null ? startGpsWatch : stopGpsWatch}
              disabled={!hasActiveAssignment}
              className="rounded-full bg-emerald-300 px-4 py-2 font-semibold text-[#080b10] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/45"
            >
              {gpsWatchId === null ? "Start live GPS" : "Stop live GPS"}
            </button>
            <button
              onClick={updateGpsOnce}
              disabled={!hasActiveAssignment}
              className="rounded-full bg-white/10 px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              Send current location
            </button>
            <button
              onClick={sendSimulatedLocationFallback}
              disabled={!hasActiveAssignment}
              className="rounded-full bg-white/10 px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              Demo fallback
            </button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            Last update: {lastGpsAt ? new Date(lastGpsAt).toLocaleTimeString() : "Not sent yet"}
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3">
          <ActionButton
            label="Check In"
            icon={Clock}
            onClick={() => {
              trackCaretakerAction("shift_check_in");
              CaretakerService.recordAttendance("check_in", "Partner app check-in");
              CaretakerService.setAvailability(session.uid, "available", true);
            }}
          />
          <ActionButton
            label="Break"
            icon={Clock}
            onClick={() => {
              trackCaretakerAction("break_started");
              CaretakerService.recordAttendance("break_start", "Short break");
              CaretakerService.setAvailability(session.uid, "standby", false);
            }}
          />
          <ActionButton
            label="Accept"
            icon={CheckCircle2}
            disabled={!hasActiveAssignment || !canAcceptCare}
            onClick={() => {
              runAssignmentAction("Accepted", () => {
                trackCaretakerAction("accepted_booking");
                return isJourneyAssignment
                  ? JourneyService.updateStatus("accepted")
                  : BookingService.acceptDispatchOffer();
              });
            }}
          />
          <ActionButton
            label="En Route"
            icon={Navigation}
            disabled={!hasActiveAssignment || !canGoEnRoute}
            onClick={() => {
              runAssignmentAction("En route", () => {
                trackCaretakerAction("marked_en_route");
                startGpsWatch();
                return isJourneyAssignment
                  ? JourneyService.updateStatus("en_route")
                  : BookingService.updateStatus("en_route", "caretaker");
              });
            }}
          />
          <ActionButton
            label="Arrived"
            icon={MapPinned}
            disabled={!hasActiveAssignment || !canMarkArrived}
            onClick={() => {
              runAssignmentAction("Arrival", () => {
                trackCaretakerAction("marked_arrived");
                return isJourneyAssignment
                  ? JourneyService.updateStatus("arrived")
                  : BookingService.updateStatus("arrived", "caretaker");
              });
            }}
          />
          <ActionButton
            label="Start with OTP"
            icon={ShieldCheck}
            disabled={!hasActiveAssignment || !canStartVisit}
            onClick={() => {
              runAssignmentAction("Visit started", () => {
                trackCaretakerAction("visit_started");
                if (isBookingAssignment) {
                  BookingService.startWithCustomerOtp(customerStartOtp);
                  return;
                }
                return isJourneyAssignment
                  ? JourneyService.updateStatus("arrived")
                  : undefined;
              });
            }}
          />
          <ActionButton
            label="Record Vitals"
            icon={ShieldCheck}
            onClick={() => {
              trackCaretakerAction("vitals_recorded");
              HealthService.simulateVitalsCheck();
            }}
          />
          <ActionButton
            label="GPS Once"
            icon={Navigation}
            disabled={!hasActiveAssignment}
            onClick={() => {
              runAssignmentAction("Location update", () => {
                updateGpsOnce();
              });
            }}
          />
          <ActionButton
            label={gpsWatchId === null ? "Live GPS" : "Stop GPS"}
            icon={Navigation}
            disabled={!hasActiveAssignment}
            onClick={() => {
              runAssignmentAction(gpsWatchId === null ? "Live GPS" : "GPS stopped", () => {
                if (gpsWatchId === null) {
                  startGpsWatch();
                } else {
                  stopGpsWatch();
                }
              });
            }}
          />
          <ActionButton
            label="Panic SOS"
            icon={AlertTriangle}
            disabled={!hasActiveAssignment}
            onClick={() => {
              runAssignmentAction("Panic SOS", () => {
                trackCaretakerAction("panic_sos_triggered");
                JourneyService.updateStatus("escalated");
              });
            }}
          />
          <ActionButton
            label="Check Out"
            icon={Clock}
            onClick={() => {
              trackCaretakerAction("shift_check_out");
              CaretakerService.recordAttendance("check_out", "Partner app check-out");
              CaretakerService.setAvailability(session.uid, "offline", false);
            }}
          />
          <button
            onClick={isJourneyAssignment ? completeJourney : completeBooking}
            disabled={!hasActiveAssignment || !canCompleteVisit}
            className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-4 font-semibold text-[#080b10] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/45"
          >
            <FileText className="h-5 w-5" />
            Complete Session & Report
          </button>
        </section>
        {actionMessage && (
          <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
            {actionMessage}
          </p>
        )}
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <Icon className="h-4 w-4 text-emerald-700" />
      <p className="mt-2 text-xs text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false
}: {
  icon: typeof Clock;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[1.5rem] bg-white/10 p-4 font-semibold disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon className="h-6 w-6 text-emerald-200" />
      {label}
    </button>
  );
}
