"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  CalendarClock,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserPlus,
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
import { trackProductEvent } from "../../services/productAnalytics";

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
    indiaFirstCommunication?: {
      whatsappBusinessConfigured: boolean;
      whatsappManualReady: boolean;
      msg91SmsConfigured: boolean;
      exotelVoiceConfigured: boolean;
      firebasePushPrepared: boolean;
      twilioFallbackConfigured: boolean;
    };
    internalOpsReadiness?: {
      slackConfigured: boolean;
      emergencyAlertsChannel: string;
      caregiverOpsChannel: string;
      lateCheckinsChannel: string;
      incidentReportsChannel: string;
    };
  };
};

type OpsKpis = {
  generatedAt: number;
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
  shiftAnalytics?: {
    activeShifts: number;
    completedToday: number;
    averageShiftMinutes: number;
    checkinsToday: number;
  };
  slaAnalytics?: {
    healthyRate: number;
    breachedRate: number;
    atRiskBookings: number;
    delayedAssignments: number;
    delayedArrivals: number;
    reassignmentCandidates: number;
  };
  funnelAnalytics?: {
    totalEvents: number;
    bookingStarts: number;
    bookingConfirms: number;
    paymentStarts: number;
    paymentConfirms: number;
    emergencyStarts: number;
    caretakerActions: number;
    opsActions: number;
    conversionRate: number;
    paymentCompletionRate: number;
    topEvents: Array<{
      name: string;
      count: number;
    }>;
  };
};

type CaregiverIntelligenceSnapshot = {
  generatedAt: number;
  averageReliability: number;
  online: number;
  watch: number;
  recommendedCaretakerId: string;
  recommendation: string;
  caretakers: Array<{
    uid: string;
    name: string;
    status: string;
    zone: string;
    reliabilityScore: number;
    risk: "trusted" | "watch" | "manual_review" | "offline";
    punctualityScore: number;
    rating: number;
    repeatVisits: number;
    activeAssignments: number;
    maxAssignments: number;
    signals: string[];
    availabilityScore: number;
    activeBookingId: string;
    lastSeenAt: number;
  }>;
  delayedAssignments: number;
  reassignmentRecommendations: number;
  dispatchRecommendations: Array<{
    bookingId: string;
    customerName: string;
    serviceType: string;
    status: string;
    priority: "normal" | "urgent" | "critical";
    slaStatus: "healthy" | "watch" | "breached";
    delayMinutes: number;
    currentCaretakerId: string;
    currentCaretakerName: string;
    recommendedCaretakerId: string;
    recommendedCaretakerName: string;
    backupCaretakerId: string;
    backupCaretakerName: string;
    matchScore: number;
    backupScore: number;
    proximityKm: number;
    skillScore: number;
    reliabilityScore: number;
    risk: "healthy" | "watch" | "breach";
    reason: string;
  }>;
  conflicts: Array<{
    caretakerId: string;
    caretakerName: string;
    activeAssignments: number;
    maxAssignments: number;
    status: string;
    severity: "watch" | "breach";
  }>;
};

type EmergencyCommandSnapshot = {
  generatedAt: number;
  commandLevel: "green" | "amber" | "red";
  emergencyCount: number;
  incidentCount: number;
  partnerDispatchCount: number;
  criticalBookings: number;
  openAlerts: number;
  panicCount: number;
  delayedBookingCount: number;
  queues: {
    command: CommandQueueItem[];
    emergency: CommandQueueItem[];
    panic: CommandQueueItem[];
    incidents: CommandQueueItem[];
    delayedBookings: CommandQueueItem[];
    alerts: CommandQueueItem[];
  };
  escalationOrder: string[];
  nextAction: string;
};

type OpsRecoverySnapshot = {
  generatedAt: number;
  openSignals: number;
  criticalSignals: number;
  assignmentStuck: number;
  dispatchOfferExpired?: number;
  arrivalDelayed: number;
  visitStartDelayed: number;
  completionVerificationDelayed?: number;
  emergencyUnresolved: number;
  signals: RecoverySignal[];
};

type OpsAuditSnapshot = {
  generatedAt: number;
  totalEvents: number;
  criticalEvents: number;
  failedEvents: number;
  automationEvents: number;
  events: OpsAuditEvent[];
};

type OpsAuditEvent = {
  id: string;
  type: "api_audit" | "recovery" | "command" | "reassignment" | "alert" | "maintenance";
  title: string;
  subtitle: string;
  actor: string;
  status: string;
  severity: "low" | "medium" | "high" | "critical";
  bookingId: string;
  createdAt: number;
};

type RecoverySignal = {
  id: string;
  bookingId: string;
  kind:
    | "assignment_stuck"
    | "arrival_delayed"
    | "dispatch_offer_expired"
    | "visit_start_delayed"
    | "completion_verification_delayed"
    | "emergency_unresolved";
  severity: "watch" | "breach" | "critical";
  status: string;
  serviceType: string;
  customerName: string;
  caretakerName: string;
  delayMinutes: number;
  recommendedAction:
    | "assign_caregiver"
    | "rebroadcast_caregivers"
    | "reassign_backup"
    | "escalate_ops"
    | "nudge_customer"
    | "advance_emergency";
  reason: string;
  createdAt: number;
};

type AiOpsSummary = {
  id: string;
  generatedAt: number;
  riskLevel: "green" | "amber" | "red";
  headline: string;
  narrative: string;
  counters: {
    activeBookings: number;
    breachedBookings: number;
    watchBookings: number;
    openIncidents: number;
    highRiskFamilies: number;
    watchFamilies: number;
    openAlerts: number;
  };
  recommendations: string[];
  anomalySignals: string[];
  model: string;
};

type CommandQueueItem = {
  id: string;
  type: "alert" | "booking" | "emergency" | "incident";
  severity: string;
  title: string;
  subtitle: string;
  status: string;
  bookingId?: string;
  customerName?: string;
  caretakerName?: string;
  currentStage?: string;
  ageMinutes: number;
  dueInMinutes: number;
  risk: string;
  nextAction: string;
};

type CustomerLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "customer_created"
  | "not_reachable"
  | "archived";

type CustomerLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: CustomerLeadStatus;
  touchCount: number;
  notes?: string;
  lastAction?: string;
  createdCustomerId?: string;
  createdAt: number;
  updatedAt: number;
};

type CustomerLeadSnapshot = {
  generatedAt: number;
  total: number;
  newCount: number;
  contactedCount: number;
  qualifiedCount: number;
  customerCreatedCount: number;
  notReachableCount: number;
  archivedCount: number;
  leads: CustomerLead[];
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
  const [caregiverIntel, setCaregiverIntel] =
    useState<CaregiverIntelligenceSnapshot | null>(null);
  const [emergencyCommand, setEmergencyCommand] =
    useState<EmergencyCommandSnapshot | null>(null);
  const [opsRecovery, setOpsRecovery] = useState<OpsRecoverySnapshot | null>(null);
  const [opsAudit, setOpsAudit] = useState<OpsAuditSnapshot | null>(null);
  const [leadSnapshot, setLeadSnapshot] = useState<CustomerLeadSnapshot | null>(null);
  const [aiOpsSummary, setAiOpsSummary] = useState<AiOpsSummary | null>(null);
  const [opsNow, setOpsNow] = useState(0);
  const [opsActionMessage, setOpsActionMessage] = useState("");

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

    const refreshOps = () => {
      setOpsNow(Date.now());
      fetch("/api/system/status")
        .then((response) => (response.ok ? response.json() : null))
        .then((status: SystemStatus | null) => setSystemStatus(status))
        .catch(() => setSystemStatus(null));
      fetch("/api/ops/kpis")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { kpis: OpsKpis } | null) => setOpsKpis(payload?.kpis || null))
        .catch(() => setOpsKpis(null));
      fetch("/api/ops/caregiver-intelligence")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { snapshot: CaregiverIntelligenceSnapshot } | null) =>
          setCaregiverIntel(payload?.snapshot || null)
        )
        .catch(() => setCaregiverIntel(null));
      fetch("/api/ops/emergency-command")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { snapshot: EmergencyCommandSnapshot } | null) =>
          setEmergencyCommand(payload?.snapshot || null)
        )
        .catch(() => setEmergencyCommand(null));
      fetch("/api/ops/recovery")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { snapshot: OpsRecoverySnapshot } | null) =>
          setOpsRecovery(payload?.snapshot || null)
        )
        .catch(() => setOpsRecovery(null));
      fetch("/api/ops/audit")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { snapshot: OpsAuditSnapshot } | null) =>
          setOpsAudit(payload?.snapshot || null)
        )
        .catch(() => setOpsAudit(null));
      fetch("/api/ops/leads")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { snapshot: CustomerLeadSnapshot } | null) =>
          setLeadSnapshot(payload?.snapshot || null)
        )
        .catch(() => setLeadSnapshot(null));
    };

    refreshOps();
    const interval = window.setInterval(refreshOps, 30000);

    return () => window.clearInterval(interval);
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
    trackProductEvent("ops_login_success", {
      source: "ops_app"
    });
    setSession(admin);
  };

  const runOpsWorkflow = async (
    label: string,
    path: string,
    body?: Record<string, unknown>
  ) => {
    setOpsActionMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: body
        ? {
            "Content-Type": "application/json"
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.ok) {
      trackProductEvent("ops_workflow_executed", {
        label,
        path,
        bookingId: booking?.id || ""
      });
      setOpsActionMessage(`${label} completed and written to the operational ledger.`);
      return response.json().catch(() => null);
    }

    setOpsActionMessage(`${label} could not be completed. Check the active booking and configuration.`);
    return null;
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
  const slaMode =
    opsKpis?.slaBreached || booking?.sla?.status === "breached"
      ? "breach"
      : opsKpis?.slaWatch || booking?.sla?.status === "watch"
        ? "watch"
        : "healthy";
  const opsFreshness = opsKpis?.generatedAt
    ? `${Math.max(0, Math.round(((opsNow || opsKpis.generatedAt) - opsKpis.generatedAt) / 1000))}s ago`
    : "live";
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
          lastLocationAt: booking.tracking?.lastLocationAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          timeline: booking.timeline
        }
      : journey;
  const dispatchRecommendations = caregiverIntel?.dispatchRecommendations || [];
  const dispatchConflicts = caregiverIntel?.conflicts || [];
  const commandQueue = emergencyCommand?.queues?.command || [];
  const panicQueue = emergencyCommand?.queues?.panic || [];
  const incidentQueue = emergencyCommand?.queues?.incidents || [];
  const delayedBookingQueue = emergencyCommand?.queues?.delayedBookings || [];
  const recoverySignals = opsRecovery?.signals || [];
  const auditEvents = opsAudit?.events || [];
  const customerLeads = leadSnapshot?.leads || [];
  const refreshLeads = async () => {
    const response = await fetch("/api/ops/leads");
    if (response.ok) {
      const payload = (await response.json()) as { snapshot: CustomerLeadSnapshot };
      setLeadSnapshot(payload.snapshot);
    }
  };
  const updateLeadStatus = async (
    lead: CustomerLead,
    status: CustomerLeadStatus,
    notes?: string
  ) => {
    setOpsActionMessage("");
    trackProductEvent("ops_lead_status_clicked", {
      leadId: lead.id,
      status,
      source: lead.source
    });
    const response = await fetch("/api/ops/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        leadId: lead.id,
        status,
        notes
      })
    });
    setOpsActionMessage(
      response.ok
        ? `${lead.name} marked ${status.replaceAll("_", " ")}.`
        : `Could not update ${lead.name}.`
    );
    await refreshLeads();
  };
  const createCustomerFromLead = async (lead: CustomerLead) => {
    setOpsActionMessage("");
    trackProductEvent("ops_lead_create_customer_clicked", {
      leadId: lead.id,
      source: lead.source
    });
    const response = await fetch("/api/ops/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "create_customer",
        leadId: lead.id
      })
    });
    const payload = (await response.json().catch(() => null)) as
      | { customerId?: string; loginId?: string; temporaryPassword?: string; error?: string }
      | null;
    setOpsActionMessage(
      response.ok
        ? `Customer prepared for ${lead.name}. Login: ${payload?.loginId}, temporary password: ${payload?.temporaryPassword}`
        : payload?.error || `Could not create customer for ${lead.name}.`
    );
    await refreshLeads();
  };
  const reassignBooking = async (recommendation: CaregiverIntelligenceSnapshot["dispatchRecommendations"][number]) => {
    setOpsActionMessage("");
    trackProductEvent("ops_reassignment_clicked", {
      bookingId: recommendation.bookingId,
      service: recommendation.serviceType,
      currentCaretakerId: recommendation.currentCaretakerId,
      backupCaretakerId: recommendation.recommendedCaretakerId || recommendation.backupCaretakerId,
      risk: recommendation.risk,
      slaStatus: recommendation.slaStatus
    });

    const response = await fetch(`/api/bookings/${encodeURIComponent(recommendation.bookingId)}/reassign`, {
      method: "POST"
    });
    setOpsActionMessage(
      response.ok
        ? `Reassignment started for ${recommendation.customerName}.`
        : "Reassignment could not be confirmed by the backend."
    );
  };
  const runCommandAction = async (
    item: CommandQueueItem,
    action: "acknowledge" | "resolve_incident" | "escalate_booking" | "resolve_alert"
  ) => {
    trackProductEvent("ops_command_center_action", {
      action,
      targetType: item.type,
      targetId: item.id,
      severity: item.severity,
      risk: item.risk
    });

    const actionResponse = await fetch("/api/ops/emergency-command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        targetType: item.type,
        targetId: item.id,
        note: `${action} from Ops Command Center`
      })
    });
    setOpsActionMessage(
      actionResponse.ok
        ? `${action.replaceAll("_", " ")} completed for ${item.title}.`
        : `Could not complete ${action.replaceAll("_", " ")}.`
    );

    const response = await fetch("/api/ops/emergency-command");
    if (response.ok) {
      const payload = (await response.json()) as { snapshot: EmergencyCommandSnapshot };
      setEmergencyCommand(payload.snapshot);
    }
  };
  const runRecoveryAction = async (signal: RecoverySignal) => {
    setOpsActionMessage("");
    trackProductEvent("ops_recovery_action_clicked", {
      bookingId: signal.bookingId,
      kind: signal.kind,
      severity: signal.severity,
      recommendedAction: signal.recommendedAction
    });

    const actionResponse = await fetch("/api/ops/recovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bookingId: signal.bookingId,
        note: `Ops recovery: ${signal.reason}`
      })
    });
    setOpsActionMessage(
      actionResponse.ok
        ? `Recovery automation started for ${signal.customerName}.`
        : "Recovery automation could not be confirmed."
    );

    const [recoveryResponse, commandResponse] = await Promise.all([
      fetch("/api/ops/recovery"),
      fetch("/api/ops/emergency-command")
    ]);

    if (recoveryResponse.ok) {
      const payload = (await recoveryResponse.json()) as { snapshot: OpsRecoverySnapshot };
      setOpsRecovery(payload.snapshot);
    }

    if (commandResponse.ok) {
      const payload = (await commandResponse.json()) as { snapshot: EmergencyCommandSnapshot };
      setEmergencyCommand(payload.snapshot);
    }
  };
  const generateAiOpsSummary = async () => {
    setOpsActionMessage("");
    trackProductEvent("ops_ai_summary_requested", {
      commandLevel: emergencyCommand?.commandLevel || "green",
      activeBookings: opsKpis?.activeBookings ?? 0,
      delayedBookings: emergencyCommand?.delayedBookingCount ?? 0,
      openIncidents: emergencyCommand?.incidentCount ?? 0
    });

    const response = await fetch("/api/ai/ops-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (response.ok) {
      const payload = (await response.json()) as { summary: AiOpsSummary };
      setAiOpsSummary(payload.summary);
      setOpsActionMessage("AI ops summary generated.");
    } else {
      setOpsActionMessage("AI ops summary could not be generated.");
    }
  };

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
              {slaMode === "breach"
                ? "SLA breach"
                : slaMode === "watch"
                  ? "SLA watch"
                  : "SLA healthy"}
            </div>
            <div className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 sm:block">
              Updated {opsFreshness}
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
        {opsActionMessage && (
          <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
            {opsActionMessage}
          </div>
        )}

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
          <OpsMetric
            icon={CalendarClock}
            label="Shift check-ins"
            value={String(opsKpis?.shiftAnalytics?.checkinsToday ?? 0)}
          />
          <OpsMetric
            icon={ShieldCheck}
            label="SLA healthy"
            value={`${opsKpis?.slaAnalytics?.healthyRate ?? 100}%`}
          />
          <OpsMetric
            icon={Sparkles}
            label="Reliability"
            value={`${caregiverIntel?.averageReliability ?? 0}%`}
          />
          <OpsMetric
            icon={AlertTriangle}
            label="Command"
            value={emergencyCommand?.commandLevel?.toUpperCase() || "GREEN"}
          />
          <OpsMetric
            icon={RotateCcw}
            label="Recovery queue"
            value={String(opsRecovery?.openSignals ?? 0)}
          />
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 text-[#071018]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <UserPlus size={16} />
                Customer lead inbox
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {leadSnapshot?.newCount
                  ? `${leadSnapshot.newCount} new family enquiries`
                  : "No new family enquiry waiting"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Leads from the public callback funnel appear here. Ops can call, qualify,
                archive, or prepare a customer account after speaking with the family.
              </p>
            </div>
            <a
              href="/signin"
              className="rounded-full bg-[#071018] px-5 py-3 text-center text-sm font-semibold text-white"
            >
              View public funnel
            </a>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-6">
            <FunnelTile label="Total" value={String(leadSnapshot?.total ?? 0)} />
            <FunnelTile label="New" value={String(leadSnapshot?.newCount ?? 0)} />
            <FunnelTile label="Contacted" value={String(leadSnapshot?.contactedCount ?? 0)} />
            <FunnelTile label="Qualified" value={String(leadSnapshot?.qualifiedCount ?? 0)} />
            <FunnelTile label="Created" value={String(leadSnapshot?.customerCreatedCount ?? 0)} />
            <FunnelTile label="Archived" value={String(leadSnapshot?.archivedCount ?? 0)} />
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {customerLeads.slice(0, 8).map((lead) => (
              <CustomerLeadCard
                key={lead.id}
                lead={lead}
                now={opsNow}
                onContacted={() => updateLeadStatus(lead, "contacted")}
                onQualified={() => updateLeadStatus(lead, "qualified")}
                onNotReachable={() => updateLeadStatus(lead, "not_reachable")}
                onArchive={() => updateLeadStatus(lead, "archived")}
                onCreateCustomer={() => createCustomerFromLead(lead)}
              />
            ))}
            {customerLeads.length === 0 && (
              <div className="rounded-3xl bg-slate-100 p-4 text-sm text-slate-500 xl:col-span-2">
                New callback requests will appear here after families submit name, phone, and email.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <div
            className={`rounded-[2rem] p-5 ${
              emergencyCommand?.commandLevel === "red"
                ? "bg-red-500/20"
                : emergencyCommand?.commandLevel === "amber"
                  ? "bg-amber-300/15"
                  : "bg-emerald-300/15"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/65">Ops command center</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {commandQueue.length
                    ? `${commandQueue.length} live issues need ownership`
                    : "All critical queues are calm"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {emergencyCommand?.nextAction ||
                    "Emergency, incident, panic, and SLA queues are monitored here."}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#071018]">
                {emergencyCommand?.commandLevel?.toUpperCase() || "GREEN"}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs">
              <SlaTile label="SOS" value={String(emergencyCommand?.emergencyCount ?? 0)} />
              <SlaTile label="Panic" value={String(emergencyCommand?.panicCount ?? 0)} />
              <SlaTile label="Incidents" value={String(emergencyCommand?.incidentCount ?? 0)} />
              <SlaTile label="Delayed" value={String(emergencyCommand?.delayedBookingCount ?? 0)} />
            </div>
            <div className="mt-5 space-y-3">
              {commandQueue.slice(0, 5).map((item) => (
                <CommandQueueCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onAcknowledge={() => runCommandAction(item, "acknowledge")}
                  onEscalate={() => runCommandAction(item, "escalate_booking")}
                  onResolve={() =>
                    runCommandAction(
                      item,
                      item.type === "incident"
                        ? "resolve_incident"
                        : item.type === "alert"
                          ? "resolve_alert"
                          : "acknowledge"
                    )
                  }
                />
              ))}
              {commandQueue.length === 0 && (
                <div className="rounded-3xl bg-white/10 p-4 text-sm text-white/60">
                  No emergency, panic, incident, or delayed SLA item needs action right now.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 text-[#071018]">
            <p className="text-sm font-semibold text-blue-700">Queue breakdown</p>
            <h2 className="mt-2 text-2xl font-semibold">Operational ownership</h2>
            <div className="mt-5 space-y-3">
              <QueueSummary
                title="Panic / SOS"
                count={panicQueue.length}
                subtitle="Immediate unsafe, distress, fall, or SOS signals."
              />
              <QueueSummary
                title="Emergency escalations"
                count={emergencyCommand?.queues?.emergency?.length || 0}
                subtitle="Customer, family, ops, ambulance, hospital chain."
              />
              <QueueSummary
                title="Care incidents"
                count={incidentQueue.length}
                subtitle="Medical, service, safety, and fall-risk incident reports."
              />
              <QueueSummary
                title="Delayed bookings"
                count={delayedBookingQueue.length}
                subtitle="Assignment or arrival SLA watch and breach queue."
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 text-[#071018]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <RotateCcw size={16} />
                Recovery automation
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {recoverySignals.length
                  ? `${recoverySignals.length} bookings need recovery`
                  : "No stuck care flow detected"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Detects stale assignments, delayed arrivals, missed visit starts, and overdue
                emergency stages, then assigns, reassigns, or escalates with an audit trail.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                opsRecovery?.criticalSignals
                  ? "bg-red-100 text-red-700"
                  : recoverySignals.length
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {opsRecovery?.criticalSignals || 0} critical
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <FunnelTile label="Assignments" value={String(opsRecovery?.assignmentStuck ?? 0)} />
            <FunnelTile label="Dispatch" value={String(opsRecovery?.dispatchOfferExpired ?? 0)} />
            <FunnelTile label="Arrivals" value={String(opsRecovery?.arrivalDelayed ?? 0)} />
            <FunnelTile label="Visit starts" value={String(opsRecovery?.visitStartDelayed ?? 0)} />
            <FunnelTile label="Verify" value={String(opsRecovery?.completionVerificationDelayed ?? 0)} />
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {recoverySignals.slice(0, 4).map((signal) => (
              <RecoverySignalCard
                key={signal.id}
                signal={signal}
                onRecover={() => runRecoveryAction(signal)}
              />
            ))}
            {recoverySignals.length === 0 && (
              <div className="rounded-3xl bg-slate-100 p-4 text-sm text-slate-500 lg:col-span-2">
                Care recovery stays quiet when assignments, arrivals, visits, and emergency stages
                are moving within SLA.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <div className="rounded-[2rem] bg-white/10 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-200">
              <ShieldCheck size={16} />
              Ops evidence ledger
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {opsAudit?.totalEvents ?? 0} recent operational records
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Recovery, command center, reassignment, alert, and audited API actions are visible
              here so ops decisions are traceable.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <SlaTile label="Automation" value={String(opsAudit?.automationEvents ?? 0)} />
              <SlaTile label="Critical" value={String(opsAudit?.criticalEvents ?? 0)} />
              <SlaTile label="Failed" value={String(opsAudit?.failedEvents ?? 0)} />
            </div>
          </div>
          <div className="rounded-[2rem] bg-white p-5 text-[#071018]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">Recent ops activity</p>
                <h2 className="mt-2 text-2xl font-semibold">Audit trail</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                live
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {auditEvents.slice(0, 6).map((event) => (
                <OpsAuditRow key={`${event.type}-${event.id}`} event={event} now={opsNow} />
              ))}
              {auditEvents.length === 0 && (
                <div className="rounded-3xl bg-slate-100 p-4 text-sm text-slate-500">
                  Audit records will appear after ops actions, recoveries, alerts, and protected API
                  mutations.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 text-[#071018]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <Sparkles size={16} />
                AI ops assistant
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {aiOpsSummary?.headline || "Generate a calm operational brief"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {aiOpsSummary?.narrative ||
                  "Summarizes live bookings, SLA pressure, incident risk, care-risk signals, and next best actions for the ops team."}
              </p>
            </div>
            <button
              onClick={generateAiOpsSummary}
              className="rounded-full bg-[#071018] px-5 py-3 text-sm font-semibold text-white"
            >
              Generate ops summary
            </button>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div
              className={`rounded-3xl p-4 text-sm ${
                aiOpsSummary?.riskLevel === "red"
                  ? "bg-red-50 text-red-800"
                  : aiOpsSummary?.riskLevel === "amber"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-800"
            }`}
          >
              <p className="text-xs font-semibold uppercase">Risk level</p>
              <p className="mt-2 text-2xl font-semibold">
                {(aiOpsSummary?.riskLevel || emergencyCommand?.commandLevel || "green").toUpperCase()}
              </p>
              <p className="mt-2 text-xs opacity-75">{aiOpsSummary?.model || "free deterministic intelligence"}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4 text-sm">
              <p className="font-semibold">Anomaly signals</p>
              <div className="mt-3 space-y-2 text-slate-600">
                {(aiOpsSummary?.anomalySignals?.length
                  ? aiOpsSummary.anomalySignals
                  : ["No generated anomaly signals yet."]
                ).map((signal) => (
                  <p key={signal}>{signal}</p>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4 text-sm">
              <p className="font-semibold">Next best actions</p>
              <div className="mt-3 space-y-2 text-slate-600">
                {(aiOpsSummary?.recommendations?.length
                  ? aiOpsSummary.recommendations
                  : ["Generate a summary to see recommended ops actions."]
                ).map((recommendation) => (
                  <p key={recommendation}>{recommendation}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
          <div
            className={`rounded-[2rem] p-5 ${
              slaMode === "breach"
                ? "bg-red-500/20"
                : slaMode === "watch"
                  ? "bg-amber-300/15"
                  : "bg-emerald-300/15"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/65">Realtime SLA command</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {slaMode === "breach"
                    ? "Intervene now"
                    : slaMode === "watch"
                      ? "Watch assignment timing"
                      : "Care flow is on time"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {opsKpis?.slaAnalytics?.atRiskBookings || 0} bookings are at risk, with{" "}
                  {opsKpis?.slaBreached ?? 0} breached and {opsKpis?.slaWatch ?? 0} on watch.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#071018]">
                {opsKpis?.slaAnalytics?.healthyRate ?? 100}% healthy
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <SlaTile label="Watch" value={String(opsKpis?.slaWatch ?? 0)} />
              <SlaTile label="Breached" value={String(opsKpis?.slaBreached ?? 0)} />
              <SlaTile
                label="Reassign"
                value={String(opsKpis?.slaAnalytics?.reassignmentCandidates ?? 0)}
              />
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 text-[#071018]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">Booking funnel intelligence</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {opsKpis?.funnelAnalytics?.conversionRate ?? 0}% booking conversion
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Server-side event capture now tracks funnel, payment, caregiver, and ops actions.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {opsKpis?.funnelAnalytics?.totalEvents ?? 0} events
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <FunnelTile
                label="Starts"
                value={String(opsKpis?.funnelAnalytics?.bookingStarts ?? 0)}
              />
              <FunnelTile
                label="Confirms"
                value={String(opsKpis?.funnelAnalytics?.bookingConfirms ?? 0)}
              />
              <FunnelTile
                label="Payment"
                value={`${opsKpis?.funnelAnalytics?.paymentCompletionRate ?? 0}%`}
              />
            </div>
            <div className="mt-4 space-y-2">
              {(opsKpis?.funnelAnalytics?.topEvents || []).slice(0, 4).map((event) => (
                <div
                  key={event.name}
                  className="flex items-center justify-between rounded-2xl bg-slate-100 px-3 py-2 text-sm"
                >
                  <span className="truncate text-slate-600">{event.name}</span>
                  <span className="font-semibold">{event.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[2rem] bg-white p-5 text-[#071018]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">Dispatch intelligence</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {dispatchRecommendations.length
                    ? `${dispatchRecommendations.length} bookings need dispatch attention`
                    : "No delayed dispatch queue"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Backup caregiver matching now considers availability, reliability, proximity, zone, capacity, and skill fit.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {caregiverIntel?.reassignmentRecommendations ?? 0} backup options
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {dispatchRecommendations.slice(0, 4).map((recommendation) => (
                <DispatchRecommendationCard
                  key={recommendation.bookingId}
                  recommendation={recommendation}
                  onReassign={() => reassignBooking(recommendation)}
                />
              ))}
              {dispatchRecommendations.length === 0 && (
                <div className="rounded-3xl bg-slate-100 p-4 text-sm text-slate-500">
                  Assignment and arrival SLAs are calm. Recommendations will appear when a booking is delayed or missing a caregiver.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-200">Live caregiver board</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {caregiverIntel?.online ?? 0} online caregivers
                </h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                {dispatchConflicts.length} conflicts
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {(caregiverIntel?.caretakers || []).slice(0, 5).map((caretaker) => (
                <CaregiverAvailabilityRow key={caretaker.uid} caretaker={caretaker} />
              ))}
            </div>
            {dispatchConflicts.length > 0 && (
              <div className="mt-5 rounded-3xl bg-red-500/15 p-4">
                <p className="font-semibold text-red-100">Dispatch conflicts</p>
                <div className="mt-3 space-y-2">
                  {dispatchConflicts.slice(0, 3).map((conflict) => (
                    <div key={conflict.caretakerId} className="rounded-2xl bg-white/10 p-3 text-sm">
                      <p className="font-semibold">{conflict.caretakerName}</p>
                      <p className="mt-1 text-white/50">
                        {conflict.status} - {conflict.activeAssignments}/{conflict.maxAssignments} active assignments
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                  onPrimary={() => {
                    trackProductEvent("ops_caregiver_assigned", {
                      bookingId: journey.id,
                      service: journey.serviceType,
                      source: "journey_queue"
                    });
                    JourneyService.assignCaretaker();
                  }}
                  onSecondary={() => {
                    trackProductEvent("ops_booking_escalated", {
                      bookingId: journey.id,
                      service: journey.serviceType,
                      source: "journey_queue"
                    });
                    JourneyService.updateStatus("escalated");
                  }}
                />
              )}
              {activeBooking && (
                <QueueRow
                  title={booking.serviceType}
                  subtitle={`${booking.customerName} - ${
                    booking.status === "searching"
                      ? `${booking.dispatch?.candidateCount || 0} caregivers notified`
                      : booking.status
                  }`}
                  priority="normal"
                  primary={booking.status === "searching" ? "Manual override" : "Assign backup"}
                  secondary="Cancel"
                  onPrimary={() => {
                    trackProductEvent("ops_caregiver_assigned", {
                      bookingId: booking.id,
                      service: booking.serviceType,
                      source: "booking_queue",
                      sla: booking.sla?.status
                    });
                    setOpsActionMessage("");
                    fetch(`/api/bookings/${encodeURIComponent(booking.id)}/assign`, {
                      method: "POST"
                    }).then((response) => {
                      setOpsActionMessage(
                        response.ok
                          ? `Assignment started for ${booking.customerName}.`
                          : "Assignment could not be confirmed by the backend."
                      );
                    });
                  }}
                  onSecondary={() => {
                    trackProductEvent("ops_booking_cancelled", {
                      bookingId: booking.id,
                      service: booking.serviceType,
                      source: "booking_queue",
                      sla: booking.sla?.status
                    });
                    setOpsActionMessage("");
                    fetch(`/api/bookings/${encodeURIComponent(booking.id)}/cancel`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        reason: "Cancelled by operations"
                      })
                    }).then((response) => {
                      setOpsActionMessage(
                        response.ok
                          ? `Cancelled ${booking.serviceType} for ${booking.customerName}.`
                          : "Cancellation could not be confirmed by the backend."
                      );
                    });
                  }}
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
              onClick={() => {
                trackProductEvent("ops_seed_caretakers_clicked", {
                  source: "caretaker_management"
                });
                CaretakerService.seedDefaults();
                setOpsActionMessage("Caretaker profiles seeded locally and sent to Firebase when allowed.");
              }}
              className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#071018]"
            >
              Seed caretaker profiles
            </button>
            {caregiverIntel && (
              <div className="rounded-2xl bg-emerald-300/15 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-emerald-100">Dispatch intelligence</p>
                    <p className="mt-1 text-white/60">{caregiverIntel.recommendation}</p>
                  </div>
                  <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-semibold text-[#071018]">
                    {caregiverIntel.averageReliability}%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <StatusPill label="Online" ready={caregiverIntel.online > 0} />
                  <StatusPill label="Watch" ready={caregiverIntel.watch === 0} />
                  <StatusPill label="Auto-match" ready={Boolean(caregiverIntel.recommendedCaretakerId)} />
                </div>
              </div>
            )}
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
              <button
                onClick={() =>
                  booking?.id &&
                  runOpsWorkflow("Open support ticket", "/api/support/tickets", {
                    bookingId: booking.id,
                    userId: booking.customerId,
                    category: "booking",
                    priority: "normal",
                    subject: "Ops callback required",
                    description: "Ops opened a customer support follow-up from command center."
                  })
                }
                disabled={!booking?.id}
                className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#071018] disabled:opacity-40"
              >
                Open support ticket
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Complaints</p>
              <p className="mt-1 text-white/50">Care quality and safety complaints create escalations.</p>
              <button
                onClick={() =>
                  booking?.id &&
                  runOpsWorkflow("Open care complaint", "/api/support/complaints", {
                    bookingId: booking.id,
                    userId: booking.customerId,
                    caretakerId: booking.caretakerId,
                    type: "service_quality",
                    severity: "medium",
                    summary: "Ops opened a care quality review from command center."
                  })
                }
                disabled={!booking?.id}
                className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#071018] disabled:opacity-40"
              >
                Open complaint review
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Refunds</p>
              <p className="mt-1 text-white/50">
                {opsKpis?.refundsRequested ?? 0} refund requests are awaiting ops review.
              </p>
              <button
                onClick={() =>
                  booking?.id &&
                  runOpsWorkflow("Open refund review", "/api/payments/refund", {
                    bookingId: booking.id,
                    reason: "Ops manual refund review"
                  })
                }
                disabled={!booking?.id}
                className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#071018] disabled:opacity-40"
              >
                Open refund review
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">KYC reviews</p>
              <p className="mt-1 text-white/50">
                Aadhaar, PAN, and face checks route through the ops review API.
              </p>
              <button
                onClick={() =>
                  caretakers[0]?.uid &&
                  runOpsWorkflow("Approve caretaker Aadhaar", "/api/caretaker/kyc/review", {
                    caretakerId: caretakers[0].uid,
                    documentType: "aadhaar",
                    status: "approved",
                    note: "Ops command center review"
                  })
                }
                disabled={!caretakers[0]?.uid}
                className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#071018] disabled:opacity-40"
              >
                Review first KYC
              </button>
            </div>
          </Panel>
          <Panel title="Monitoring">
            <div className="grid grid-cols-3 gap-3">
              <StatusPill label="Sentry" ready={Boolean(opsKpis?.monitoring.sentryConfigured)} />
              <StatusPill label="PostHog" ready={Boolean(opsKpis?.monitoring.posthogConfigured)} />
              <StatusPill label="Mixpanel" ready={Boolean(opsKpis?.monitoring.mixpanelConfigured)} />
            </div>
          </Panel>
          <Panel title="India communication stack">
            <div className="grid grid-cols-2 gap-3">
              <StatusPill
                label="WhatsApp API"
                ready={Boolean(
                  systemStatus?.productionReadiness.indiaFirstCommunication
                    ?.whatsappBusinessConfigured
                )}
              />
              <StatusPill
                label="Manual WhatsApp"
                ready={Boolean(
                  systemStatus?.productionReadiness.indiaFirstCommunication
                    ?.whatsappManualReady
                )}
              />
              <StatusPill
                label="MSG91 SMS"
                ready={Boolean(
                  systemStatus?.productionReadiness.indiaFirstCommunication
                    ?.msg91SmsConfigured
                )}
              />
              <StatusPill
                label="Exotel voice"
                ready={Boolean(
                  systemStatus?.productionReadiness.indiaFirstCommunication
                    ?.exotelVoiceConfigured
                )}
              />
            </div>
            <button
              onClick={() => {
                setOpsActionMessage("");
                fetch("/api/ops/alerts", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    kind: "sla_breach",
                    severity: "high",
                    bookingId: booking?.id,
                    title: "Ops alert test",
                    message: "LDERLY ops alert route is ready for SLA and emergency escalation."
                  })
                }).then((response) => {
                  setOpsActionMessage(
                    response.ok
                      ? "Ops alert created and routed into the command center."
                      : "Ops alert could not be created."
                  );
                });
              }}
              className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#071018]"
            >
              Test ops alert route
            </button>
            <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/50">
              Internal alerts are prepared for #emergency-alerts, #caregiver-ops,
              #late-checkins, and #incident-reports.
            </div>
          </Panel>
          <Panel title="Workforce and family access">
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Attendance tracking</p>
              <p className="mt-1 text-white/50">
                Partner check-in, break, and check-out events now write to shift history.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Push tokens</p>
              <p className="mt-1 text-white/50">
                Customer, caretaker, and admin devices can register Firebase push tokens.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Family report grants</p>
              <p className="mt-1 text-white/50">
                Visit reports can be granted to family members without exposing all customer data.
              </p>
            </div>
          </Panel>
          <Panel title="Emergency and partners">
            {emergencyCommand && (
              <div
                className={`rounded-2xl p-4 text-sm ${
                  emergencyCommand.commandLevel === "red"
                    ? "bg-red-500/20"
                    : emergencyCommand.commandLevel === "amber"
                      ? "bg-amber-300/15"
                      : "bg-emerald-300/15"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Emergency command center</p>
                    <p className="mt-1 text-white/60">{emergencyCommand.nextAction}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#071018]">
                    {emergencyCommand.commandLevel}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <StatusPill label="SOS" ready={emergencyCommand.emergencyCount === 0} />
                  <StatusPill label="Incidents" ready={emergencyCommand.incidentCount === 0} />
                  <StatusPill label="Partners" ready={emergencyCommand.partnerDispatchCount >= 0} />
                </div>
                <p className="mt-3 text-xs text-white/45">
                  Escalation: {emergencyCommand.escalationOrder.join(" -> ")}
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setOpsActionMessage("");
                fetch("/api/partners", {
                  method: "POST"
                }).then((response) => {
                  setOpsActionMessage(
                    response.ok
                      ? "Care partners seeded into the partner marketplace."
                      : "Care partners could not be seeded."
                  );
                });
              }}
              className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#071018]"
            >
              Seed care partners
            </button>
            <button
              onClick={() =>
                runOpsWorkflow("Dispatch ambulance partner", "/api/partners/dispatch", {
                  partnerType: "ambulance",
                  bookingId: booking?.id,
                  zone: booking?.matching?.zone || "Central",
                  reason: "Ops emergency readiness drill"
                })
              }
              className="w-full rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Dispatch ambulance partner
            </button>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Emergency escalation</p>
              <p className="mt-1 text-white/50">
                Customer, family, ops, ambulance, and hospital stages are now tracked.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Partner dispatch</p>
              <p className="mt-1 text-white/50">
                Ambulance, labs, pharmacies, hospitals, and physio partners can be dispatched by SLA.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">NRI reports</p>
              <p className="mt-1 text-white/50">
                Monthly family summaries are ready for PDF and WhatsApp delivery.
              </p>
            </div>
          </Panel>
          <Panel title="Finance operations">
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">GST invoices</p>
              <p className="mt-1 text-white/50">
                Invoice records now track taxable value, GST, line items, and PDF readiness.
              </p>
              <button
                onClick={() =>
                  booking?.id &&
                  runOpsWorkflow("Generate GST invoice", "/api/finance/invoice", {
                    bookingId: booking.id,
                    billTo: booking.customerName
                  })
                }
                disabled={!booking?.id}
                className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#071018] disabled:opacity-40"
              >
                Generate invoice
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Caregiver payouts</p>
              <p className="mt-1 text-white/50">
                Payout and incentive records are queued for ops reconciliation.
              </p>
              <button
                onClick={() =>
                  booking?.id &&
                  runOpsWorkflow("Queue caregiver payout", "/api/finance/payout", {
                    bookingId: booking.id,
                    caretakerId: booking.caretakerId,
                    incentiveAmount: 0
                  })
                }
                disabled={!booking?.id || !booking?.caretakerId}
                className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#071018] disabled:opacity-40"
              >
                Queue payout
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-sm">
              <p className="font-semibold">Recurring care</p>
              <p className="mt-1 text-white/50">
                Weekly and monthly subscriptions can be created from customer plans.
              </p>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function CustomerLeadCard({
  lead,
  now,
  onContacted,
  onQualified,
  onNotReachable,
  onArchive,
  onCreateCustomer
}: {
  lead: CustomerLead;
  now: number;
  onContacted: () => void;
  onQualified: () => void;
  onNotReachable: () => void;
  onArchive: () => void;
  onCreateCustomer: () => void;
}) {
  const statusClass =
    lead.status === "customer_created"
      ? "bg-emerald-100 text-emerald-700"
      : lead.status === "qualified"
        ? "bg-blue-100 text-blue-700"
        : lead.status === "not_reachable"
          ? "bg-amber-100 text-amber-700"
          : lead.status === "archived"
            ? "bg-slate-200 text-slate-500"
            : "bg-red-100 text-red-700";
  const updatedAgo = lead.updatedAt
    ? `${Math.max(0, Math.round(((now || lead.updatedAt) - lead.updatedAt) / 60000))}m ago`
    : "new";

  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{lead.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {lead.source || "web"} - updated {updatedAgo}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
          {lead.status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <a
          href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 font-semibold text-[#071018]"
        >
          <Phone className="h-4 w-4 text-emerald-700" />
          {lead.phone}
        </a>
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-2 rounded-2xl bg-white px-3 py-3 font-semibold text-[#071018]"
        >
          <Mail className="h-4 w-4 text-blue-700" />
          {lead.email}
        </a>
      </div>
      <div className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">
        <p className="font-semibold text-[#071018]">
          {lead.lastAction || "Call family and verify care need"}
        </p>
        <p className="mt-1">
          Touches: {lead.touchCount || 1}
          {lead.createdCustomerId ? ` - Customer: ${lead.createdCustomerId}` : ""}
        </p>
        {lead.notes && <p className="mt-2 text-slate-500">{lead.notes}</p>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <button
          onClick={onContacted}
          className="rounded-full bg-white px-3 py-3 text-xs font-semibold text-[#071018]"
        >
          Contacted
        </button>
        <button
          onClick={onQualified}
          className="rounded-full bg-blue-100 px-3 py-3 text-xs font-semibold text-blue-700"
        >
          Qualified
        </button>
        <button
          onClick={onCreateCustomer}
          disabled={lead.status === "customer_created"}
          className="rounded-full bg-[#071018] px-3 py-3 text-xs font-semibold text-white disabled:bg-slate-300"
        >
          Create ID
        </button>
        <button
          onClick={onNotReachable}
          className="rounded-full bg-amber-100 px-3 py-3 text-xs font-semibold text-amber-700"
        >
          No answer
        </button>
        <button
          onClick={onArchive}
          className="rounded-full bg-slate-200 px-3 py-3 text-xs font-semibold text-slate-600"
        >
          Archive
        </button>
      </div>
    </div>
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

function SlaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-white/50">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function FunnelTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function CommandQueueCard({
  item,
  onAcknowledge,
  onEscalate,
  onResolve
}: {
  item: CommandQueueItem;
  onAcknowledge: () => void;
  onEscalate: () => void;
  onResolve: () => void;
}) {
  const riskClass =
    item.risk === "critical" || item.risk === "breach"
      ? "bg-red-100 text-red-700"
      : item.risk === "high"
        ? "bg-amber-100 text-amber-700"
        : "bg-white/10 text-white";
  const canEscalate = item.type === "booking";
  const canResolve = item.type === "incident" || item.type === "alert";

  return (
    <div className="rounded-3xl bg-white p-4 text-[#071018]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskClass}`}>
          {item.severity}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <FunnelTile label="Age" value={`${item.ageMinutes}m`} />
        <FunnelTile label="Due" value={`${item.dueInMinutes}m`} />
        <FunnelTile label="Type" value={item.type} />
      </div>
      <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">
        {item.nextAction}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={onAcknowledge}
          className="rounded-full bg-[#071018] px-3 py-3 text-xs font-semibold text-white"
        >
          Own
        </button>
        <button
          onClick={onEscalate}
          disabled={!canEscalate}
          className="rounded-full bg-red-100 px-3 py-3 text-xs font-semibold text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
        >
          Escalate
        </button>
        <button
          onClick={onResolve}
          disabled={!canResolve}
          className="rounded-full bg-emerald-100 px-3 py-3 text-xs font-semibold text-emerald-700 disabled:bg-slate-100 disabled:text-slate-400"
        >
          Resolve
        </button>
      </div>
    </div>
  );
}

function RecoverySignalCard({
  signal,
  onRecover
}: {
  signal: RecoverySignal;
  onRecover: () => void;
}) {
  const severityClass =
    signal.severity === "critical"
      ? "bg-red-100 text-red-700"
      : signal.severity === "breach"
        ? "bg-amber-100 text-amber-700"
        : "bg-blue-100 text-blue-700";
  const actionLabel =
    signal.recommendedAction === "assign_caregiver"
      ? "Assign caregiver"
      : signal.recommendedAction === "rebroadcast_caregivers"
        ? "Rebroadcast caregivers"
      : signal.recommendedAction === "reassign_backup"
        ? "Reassign backup"
        : signal.recommendedAction === "nudge_customer"
          ? "Nudge family"
        : signal.recommendedAction === "advance_emergency"
          ? "Escalate emergency"
          : "Escalate ops";

  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{signal.serviceType}</p>
          <p className="mt-1 text-sm text-slate-500">
            {signal.customerName} - {signal.status} - {signal.delayMinutes}m delayed
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClass}`}>
          {signal.severity}
        </span>
      </div>
      <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-slate-600">
        <p className="font-semibold text-[#071018]">{actionLabel}</p>
        <p className="mt-1">{signal.reason}</p>
        <p className="mt-2 text-xs text-slate-400">{signal.caretakerName}</p>
      </div>
      <button
        onClick={onRecover}
        className="mt-3 w-full rounded-full bg-[#071018] px-4 py-3 text-sm font-semibold text-white"
      >
        Run recovery
      </button>
    </div>
  );
}

function OpsAuditRow({ event, now }: { event: OpsAuditEvent; now: number }) {
  const severityClass =
    event.severity === "critical"
      ? "bg-red-100 text-red-700"
      : event.severity === "high"
        ? "bg-amber-100 text-amber-700"
        : event.severity === "medium"
          ? "bg-blue-100 text-blue-700"
          : "bg-emerald-100 text-emerald-700";
  const minutesAgo = Math.max(0, Math.round(((now || event.createdAt) - event.createdAt) / 60000));

  return (
    <div className="rounded-3xl bg-slate-100 p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{event.title}</p>
          <p className="mt-1 text-slate-500">{event.subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClass}`}>
          {event.type}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-white px-3 py-1">{event.actor}</span>
        <span className="rounded-full bg-white px-3 py-1">{event.status}</span>
        <span className="rounded-full bg-white px-3 py-1">{minutesAgo}m ago</span>
        {event.bookingId && (
          <span className="rounded-full bg-white px-3 py-1">{event.bookingId}</span>
        )}
      </div>
    </div>
  );
}

function QueueSummary({
  title,
  count,
  subtitle
}: {
  title: string;
  count: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            count ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

function DispatchRecommendationCard({
  recommendation,
  onReassign
}: {
  recommendation: CaregiverIntelligenceSnapshot["dispatchRecommendations"][number];
  onReassign: () => void;
}) {
  const riskClass =
    recommendation.risk === "breach"
      ? "bg-red-100 text-red-700"
      : recommendation.risk === "watch"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{recommendation.serviceType}</p>
          <p className="mt-1 text-sm text-slate-500">
            {recommendation.customerName} - {recommendation.status} -{" "}
            {recommendation.delayMinutes ? `${recommendation.delayMinutes}m delayed` : "on time"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskClass}`}>
          {recommendation.risk}
        </span>
      </div>
      <div className="mt-4 rounded-2xl bg-white p-3 text-sm">
        <p className="font-semibold">
          Recommend {recommendation.recommendedCaretakerName || "backup caregiver"}
        </p>
        <p className="mt-1 text-slate-500">{recommendation.reason}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <FunnelTile label="Match" value={`${recommendation.matchScore}%`} />
        <FunnelTile label="Skill" value={`${recommendation.skillScore}%`} />
        <FunnelTile label="Distance" value={`${recommendation.proximityKm} km`} />
      </div>
      <button
        onClick={onReassign}
        disabled={!recommendation.recommendedCaretakerId}
        className="mt-4 w-full rounded-full bg-[#071018] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Reassign to recommended caregiver
      </button>
    </div>
  );
}

function CaregiverAvailabilityRow({
  caretaker
}: {
  caretaker: CaregiverIntelligenceSnapshot["caretakers"][number];
}) {
  const statusClass =
    caretaker.risk === "trusted"
      ? "bg-emerald-300 text-[#071018]"
      : caretaker.risk === "offline"
        ? "bg-white/10 text-white/50"
        : "bg-amber-300 text-[#071018]";

  return (
    <div className="rounded-2xl bg-white/10 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{caretaker.name}</p>
          <p className="mt-1 text-white/50">
            {caretaker.status} - {caretaker.zone} - {caretaker.activeAssignments}/{caretaker.maxAssignments} active
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
          {caretaker.reliabilityScore}%
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/55">
        <div className="rounded-2xl bg-white/10 p-2">Availability {caretaker.availabilityScore}%</div>
        <div className="rounded-2xl bg-white/10 p-2">Rating {caretaker.rating.toFixed(1)}</div>
        <div className="rounded-2xl bg-white/10 p-2">{caretaker.repeatVisits} repeats</div>
      </div>
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
