"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
import { HealthService, HealthSnapshot } from "../../services/healthService";
import { JourneyService, CareJourney } from "../../services/journeyService";
import { ReportService } from "../../services/reportService";

export default function PartnerApp() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [journey, setJourney] = useState<CareJourney | null>(null);
  const [booking, setBooking] = useState<CareBooking | null>(null);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [caretakerUsername, setCaretakerUsername] = useState("");
  const [caretakerPassword, setCaretakerPassword] = useState("");
  const [caretakerError, setCaretakerError] = useState("");

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
    setSession(partner);
  };

  const bookingIsFreshestActiveCare =
    Boolean(booking && booking.status !== "none") &&
    (!journey || journey.status === "idle" || (booking?.updatedAt ?? 0) >= journey.updatedAt);
  const activeJourney = bookingIsFreshestActiveCare ? null : journey;
  const activeBooking = booking;
  const isJourneyAssignment = Boolean(activeJourney && activeJourney.status !== "idle");
  const isBookingAssignment = Boolean(activeBooking && activeBooking.status !== "none");

  const completeBooking = () => {
    BookingService.updateStatus("completed");
    ReportService.createFromBooking(activeBooking, health);
  };

  const completeJourney = () => {
    JourneyService.updateStatus("completed");
    ReportService.createFromJourney(activeJourney, health);
  };

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
            <div className="rounded-full bg-emerald-300 px-3 py-2 text-sm font-semibold text-[#080b10]">
              Online
            </div>
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
            <Metric icon={Clock} label="ETA" value={`${activeJourney?.eta || 8}m`} />
            <Metric icon={ShieldCheck} label="Rating" value="4.9" />
            <Metric icon={MapPinned} label="Area" value="Near" />
          </div>
        </section>

        <div className="mt-5">
          <LiveMap journey={activeJourney} />
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3">
          <ActionButton
            label="Accept"
            icon={CheckCircle2}
            onClick={() =>
              isJourneyAssignment
                ? JourneyService.updateStatus("accepted")
                : BookingService.updateStatus("accepted")
            }
          />
          <ActionButton
            label="En Route"
            icon={Navigation}
            onClick={() =>
              isJourneyAssignment
                ? JourneyService.updateStatus("en_route")
                : BookingService.updateStatus("in_progress")
            }
          />
          <ActionButton
            label="Arrived"
            icon={MapPinned}
            onClick={() => JourneyService.updateStatus("arrived")}
          />
          <ActionButton
            label="Record Vitals"
            icon={ShieldCheck}
            onClick={HealthService.simulateVitalsCheck}
          />
          <button
            onClick={isJourneyAssignment ? completeJourney : completeBooking}
            className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-4 font-semibold text-[#080b10]"
          >
            <FileText className="h-5 w-5" />
            Complete Session & Report
          </button>
        </section>
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
  onClick
}: {
  icon: typeof Clock;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[1.5rem] bg-white/10 p-4 font-semibold"
    >
      <Icon className="h-6 w-6 text-emerald-200" />
      {label}
    </button>
  );
}
