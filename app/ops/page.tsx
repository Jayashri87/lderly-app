"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  CalendarClock,
  ShieldCheck,
  Users
} from "lucide-react";
import LiveMap from "../../components/LiveMap";
import { AuthService, SessionUser } from "../../services/authService";
import { BookingService, CareBooking } from "../../services/bookingService";
import {
  CaretakerProfile,
  CaretakerService
} from "../../services/caretakerService";
import { CareJourney, JourneyService } from "../../services/journeyService";
import {
  CareNotification,
  NotificationService
} from "../../services/notificationService";

type SystemStatus = {
  firebaseAdmin: {
    configured: boolean;
    mode: string;
  };
  auth: {
    signedSessions: boolean;
    adminCredentials: boolean;
    caretakerCredentials: boolean;
    customerCredentials: boolean;
  };
  productionReadiness: {
    pending: string[];
  };
};

export default function OpsApp() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [journey, setJourney] = useState<CareJourney | null>(null);
  const [booking, setBooking] = useState<CareBooking | null>(null);
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [caretakers, setCaretakers] = useState<CaretakerProfile[]>([]);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    return AuthService.subscribe((user) => setSession(user));
  }, []);

  useEffect(() => {
    if (!session || session.role !== "admin") {
      return;
    }

    const unsubscribers = [
      JourneyService.subscribe(session, setJourney),
      BookingService.subscribe(session, setBooking),
      NotificationService.subscribe(session, setNotifications),
      CaretakerService.subscribe(setCaretakers)
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== "admin") {
      return;
    }

    fetch("/api/system/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status: SystemStatus | null) => setSystemStatus(status))
      .catch(() => setSystemStatus(null));
  }, [session]);

  const enterOps = async () => {
    setAdminError("");
    const response = await fetch("/api/auth/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: adminUsername,
        password: adminPassword
      })
    });

    if (!response.ok) {
      setAdminError("Check the admin username and password.");
      return;
    }

    const admin = await AuthService.continueAs("admin");
    CaretakerService.seedDefaults();
    setSession(admin);
  };

  if (!session || session.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071018] px-5 text-white">
        <section className="w-full max-w-md rounded-[2rem] bg-white p-6 text-[#071018]">
          <p className="text-sm font-semibold text-blue-700">LDERLY Ops</p>
          <h1 className="mt-3 text-3xl font-semibold">Operations control center</h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor active care requests, assign caregivers, handle escalations, and track SLAs.
          </p>
          <div className="mt-6 space-y-3">
            <input
              autoComplete="username"
              value={adminUsername}
              onChange={(event) => setAdminUsername(event.target.value)}
              placeholder="Admin username"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <input
              autoComplete="current-password"
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          {adminError && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {adminError}
            </p>
          )}
          <button
            onClick={enterOps}
            className="mt-4 w-full rounded-full bg-[#071018] px-5 py-4 font-semibold text-white"
          >
            Enter Ops Panel
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

  const activeJourney = journey && journey.status !== "idle";
  const activeBooking = booking && booking.status !== "none";

  return (
    <main className="min-h-screen bg-[#071018] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-blue-200">LDERLY Ops</p>
            <h1 className="mt-1 text-3xl font-semibold">Live operations</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-400 px-4 py-2 text-sm font-semibold text-[#071018]">
              SLA watch active
            </div>
            <button
              onClick={async () => {
                await AuthService.signOut();
                setSession(null);
                router.replace("/ops");
              }}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <OpsMetric icon={BellRing} label="Active bookings" value={activeBooking ? "1" : "0"} />
          <OpsMetric icon={AlertTriangle} label="Escalations" value={activeJourney ? "1" : "0"} />
          <OpsMetric
            icon={Users}
            label="Caregivers online"
            value={String(caretakers.filter((item) => item.available).length)}
          />
          <OpsMetric icon={BarChart3} label="SLA" value="94%" />
        </section>

        {systemStatus && (
          <section className="mt-6 rounded-[2rem] bg-white/10 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-200">Production status</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {systemStatus.firebaseAdmin.configured
                    ? "Trusted writes active"
                    : "Client fallback mode"}
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  Booking APIs, scoped reads, and signed sessions are available.
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  systemStatus.firebaseAdmin.configured
                    ? "bg-emerald-300 text-[#071018]"
                    : "bg-amber-300 text-[#071018]"
                }`}
              >
                {systemStatus.firebaseAdmin.mode}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <StatusPill label="Signed sessions" ready={systemStatus.auth.signedSessions} />
              <StatusPill label="Admin login" ready={systemStatus.auth.adminCredentials} />
              <StatusPill label="Caretaker login" ready={systemStatus.auth.caretakerCredentials} />
              <StatusPill label="Customer login" ready={systemStatus.auth.customerCredentials} />
            </div>
            {systemStatus.productionReadiness.pending.length > 0 && (
              <div className="mt-5 rounded-3xl bg-white/10 p-4">
                <p className="text-sm font-semibold text-white/70">Pending</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {systemStatus.productionReadiness.pending.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[2rem] bg-white p-5 text-[#071018]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">Dispatch queue</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {activeJourney || activeBooking ? "Care request needs action" : "No critical queue"}
                </h2>
              </div>
              <ShieldCheck className="h-8 w-8 text-blue-700" />
            </div>
            <div className="mt-5 space-y-3">
              {activeJourney && (
                <QueueRow
                  title={journey.serviceType}
                  subtitle={`${journey.customerName} - ${journey.status}`}
                  priority={journey.priority}
                  primary="Assign Anita"
                  secondary="Escalate"
                  onPrimary={JourneyService.assignCaretaker}
                  onSecondary={() => JourneyService.updateStatus("escalated")}
                />
              )}
              {activeBooking && (
                <QueueRow
                  title={booking.serviceType}
                  subtitle={`${booking.customerName} - ${booking.status}`}
                  priority="normal"
                  primary="Assign Anita"
                  secondary="Cancel"
                  onPrimary={BookingService.assignCaretaker}
                  onSecondary={() => BookingService.updateStatus("cancelled")}
                />
              )}
              {!activeJourney && !activeBooking && (
                <div className="rounded-3xl bg-slate-100 p-4 text-sm text-slate-500">
                  All queues are calm. New requests will appear here in real time.
                </div>
              )}
            </div>
          </div>

          <div>
            <LiveMap journey={journey} />
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <Panel title="Caretaker management">
            <button
              onClick={CaretakerService.seedDefaults}
              className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#071018]"
            >
              Seed caretaker profiles
            </button>
            {caretakers.map((caretaker) => (
              <CaretakerRow key={caretaker.uid} caretaker={caretaker} />
            ))}
          </Panel>
          <Panel title="Recent notifications">
            {notifications.slice(0, 5).map((notification) => (
              <div key={notification.id} className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">{notification.title}</p>
                <p className="mt-1 text-sm text-white/50">{notification.body}</p>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/50">
                No notifications yet
              </div>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs text-white/45">{label}</p>
      <p className={`mt-1 font-semibold ${ready ? "text-emerald-200" : "text-amber-200"}`}>
        {ready ? "Ready" : "Pending"}
      </p>
    </div>
  );
}

function CaretakerRow({ caretaker }: { caretaker: CaretakerProfile }) {
  const statusLabel =
    caretaker.status === "on_visit"
      ? "On visit"
      : caretaker.status === "standby"
        ? "Standby"
        : caretaker.status === "available"
          ? "Available"
          : "Offline";

  return (
    <div className="rounded-2xl bg-white/10 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{caretaker.name}</p>
          <p className="mt-1 text-white/50">
            {statusLabel} - {caretaker.zone} - {caretaker.rating.toFixed(1)}
          </p>
        </div>
        <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">
          {caretaker.punctualityScore}% punctual
        </span>
      </div>
      <p className="mt-3 text-xs text-white/45">{caretaker.skills.join(", ")}</p>
      <p className="mt-2 text-xs text-white/45">
        {caretaker.languages.join(", ")} - {caretaker.yearsExperience} yrs exp - {caretaker.repeatVisits} repeat visits
      </p>
    </div>
  );
}

function OpsMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof BellRing;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/10 p-4">
      <Icon className="h-5 w-5 text-blue-200" />
      <p className="mt-3 text-sm text-white/50">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function QueueRow({
  title,
  subtitle,
  priority,
  primary,
  secondary,
  onPrimary,
  onSecondary
}: {
  title: string;
  subtitle: string;
  priority: string;
  primary: string;
  secondary: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          {priority}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={onPrimary}
          className="rounded-full bg-[#071018] px-4 py-3 font-semibold text-white"
        >
          {primary}
        </button>
        <button
          onClick={onSecondary}
          className="rounded-full bg-white px-4 py-3 font-semibold text-[#071018]"
        >
          {secondary}
        </button>
      </div>
    </div>
  );
}

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] bg-white/10 p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-blue-200" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
