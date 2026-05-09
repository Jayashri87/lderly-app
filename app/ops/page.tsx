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

type OpsKpis = {
  activeBookings: number;
  onlineCaretakers: number;
  slaWatch: number;
  slaBreached: number;
  supportOpen: number;
  complaintsOpen: number;
  refundsRequested: number;
  notificationsQueued: number;
  monitoring: {
    sentryConfigured: boolean;
    posthogConfigured: boolean;
    mixpanelConfigured: boolean;
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
  const [opsKpis, setOpsKpis] = useState<OpsKpis | null>(null);

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
    fetch("/api/ops/kpis")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { kpis: OpsKpis } | null) => setOpsKpis(payload?.kpis || null))
      .catch(() => setOpsKpis(null));
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
  const bookingMapJourney: CareJourney | null =
    booking && booking.status !== "none"
      ? {
          id: booking.id,
          status:
            booking.status === "en_route"
              ? "en_route"
              : booking.status === "arrived"
                ? "arrived"
                : booking.status === "completed" ||
                    booking.status === "payment_settled" ||
                    booking.status === "report_generated" ||
                    booking.status === "cancelled"
                  ? "completed"
                  : booking.status === "assigned"
                    ? "assigned"
                    : booking.status === "accepted"
                      ? "accepted"
                      : "requested",
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
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          timeline: booking.timeline
        }
      : journey;

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
          <OpsMetric
            icon={BellRing}
            label="Active bookings"
            value={String(opsKpis?.activeBookings ?? (activeBooking ? 1 : 0))}
          />
          <OpsMetric
            icon={AlertTriangle}
            label="SLA watch"
            value={
              opsKpis?.slaBreached
                ? "Breach"
                : opsKpis?.slaWatch
                  ? "Watch"
                  : booking?.sla?.status === "breached"
                ? "Breach"
                : booking?.sla?.status === "watch"
                  ? "Watch"
                  : "0"
            }
          />
          <OpsMetric
            icon={Users}
            label="Caregivers online"
            value={String(opsKpis?.onlineCaretakers ?? caretakers.filter((item) => item.available).length)}
          />
          <OpsMetric
            icon={BarChart3}
            label="Support ops"
            value={`${opsKpis?.supportOpen ?? 0}/${opsKpis?.complaintsOpen ?? 0}`}
          />
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
                  onSecondary={() => BookingService.cancelBooking("Cancelled by operations", "admin")}
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
            <LiveMap journey={bookingMapJourney} />
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
          <Panel title="Reliability queues">
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Support tickets</p>
              <p className="mt-1 text-white/50">Customer issues route into ops support queue.</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Complaints</p>
              <p className="mt-1 text-white/50">Care quality and safety complaints create escalations.</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Refunds</p>
              <p className="mt-1 text-white/50">
                {opsKpis?.refundsRequested ?? 0} refund requests are awaiting ops review.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">KYC reviews</p>
              <p className="mt-1 text-white/50">
                Aadhaar, PAN, and face checks route through the ops review API.
              </p>
            </div>
          </Panel>
          <Panel title="Monitoring">
            <div className="grid grid-cols-3 gap-3">
              <StatusPill label="Sentry" ready={Boolean(opsKpis?.monitoring.sentryConfigured)} />
              <StatusPill label="PostHog" ready={Boolean(opsKpis?.monitoring.posthogConfigured)} />
              <StatusPill label="Mixpanel" ready={Boolean(opsKpis?.monitoring.mixpanelConfigured)} />
            </div>
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
