import { getAdminDatabase } from "./firebaseAdmin";
import type { CareBooking } from "../services/bookingService";

type IncidentRecord = {
  id: string;
  severity?: "low" | "medium" | "high" | "critical";
  category?: string;
  summary?: string;
  status?: string;
  createdAt?: number;
};

type CareRiskRecord = {
  userId?: string;
  recipientName?: string;
  riskScore?: number;
  riskLevel?: "stable" | "watch" | "high";
  missedCareSignals?: string[];
  recommendations?: string[];
};

type ReportRecord = {
  id: string;
  userId?: string;
  serviceType?: string;
  familySummary?: string;
  caregiverNote?: string;
  completedAt?: number;
  aiSummary?: {
    riskLevel?: string;
    nextBestAction?: string;
  };
};

const activeStatuses = ["requested", "searching", "assigned", "accepted", "en_route", "arrived", "in_progress"];

const severityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");

const calmSentence = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\b(?:urgent!!!|asap!!!|panic!!!)\b/gi, "urgent")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const riskTagsForNote = (note: string) => {
  const lower = note.toLowerCase();

  return [
    ...(lower.match(/fall|slip|dizzy|unstable/) ? ["fall-risk"] : []),
    ...(lower.match(/missed|forgot|skipped/) ? ["missed-care"] : []),
    ...(lower.match(/bp|blood pressure|oxygen|fever|pain/) ? ["medical"] : []),
    ...(lower.match(/sad|lonely|confused|memory/) ? ["emotional-watch"] : [])
  ];
};

export const AiIntelligenceProvider = {
  async opsSummary() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [bookingsSnapshot, incidentsSnapshot, risksSnapshot, reportsSnapshot, alertsSnapshot] =
      await Promise.all([
        database.ref("bookings/byId").get(),
        database.ref("incidents/byId").get(),
        database.ref("careRisk/byUser").get(),
        database.ref("reports/byId").get(),
        database.ref("operations/internalAlerts/byId").get()
      ]);
    const bookings = Object.values(
      (bookingsSnapshot.val() || {}) as Record<string, CareBooking>
    );
    const incidents = Object.values(
      (incidentsSnapshot.val() || {}) as Record<string, IncidentRecord>
    );
    const risks = Object.values((risksSnapshot.val() || {}) as Record<string, CareRiskRecord>);
    const reports = Object.values((reportsSnapshot.val() || {}) as Record<string, ReportRecord>);
    const alerts = Object.values(
      (alertsSnapshot.val() || {}) as Record<string, { status?: string; severity?: string }>
    );
    const activeBookings = bookings.filter((booking) => activeStatuses.includes(booking.status));
    const breachedBookings = activeBookings.filter((booking) => booking.sla?.status === "breached");
    const watchBookings = activeBookings.filter((booking) => booking.sla?.status === "watch");
    const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
    const highRiskFamilies = risks.filter((risk) => risk.riskLevel === "high");
    const watchFamilies = risks.filter((risk) => risk.riskLevel === "watch");
    const openAlerts = alerts.filter((alert) => alert.status !== "resolved");
    const topIncident = [...openIncidents].sort(
      (a, b) => (severityWeight[b.severity || "low"] || 0) - (severityWeight[a.severity || "low"] || 0)
    )[0];
    const watchReports = reports.filter((report) => report.aiSummary?.riskLevel === "watch");
    const riskLevel =
      breachedBookings.length || highRiskFamilies.length || openIncidents.some((item) => item.severity === "critical")
        ? "red"
        : watchBookings.length || watchFamilies.length || openIncidents.length || openAlerts.length
          ? "amber"
          : "green";
    const recommendations = [
      ...(breachedBookings.length ? ["Resolve breached care SLAs before accepting new non-urgent bookings."] : []),
      ...(highRiskFamilies.length ? ["Call high-risk families and verify emergency contacts are reachable."] : []),
      ...(topIncident ? [`Review ${topIncident.severity || "open"} incident: ${topIncident.summary || topIncident.category}.`] : []),
      ...(watchReports.length ? ["Send follow-up notes for visits flagged as watch in AI summaries."] : []),
      ...(riskLevel === "green" ? ["Keep monitoring live care, medicine adherence, and shift check-ins."] : [])
    ].slice(0, 5);
    const summary = {
      id: `ai-ops-${Date.now()}`,
      generatedAt: Date.now(),
      riskLevel,
      headline:
        riskLevel === "red"
          ? "Ops attention needed now"
          : riskLevel === "amber"
            ? "Ops should review watch queues"
            : "Operations look calm",
      narrative:
        riskLevel === "green"
          ? "Bookings, incidents, alerts, and family risk signals are currently within expected operating range."
          : `${breachedBookings.length} breached booking(s), ${watchBookings.length} SLA watch booking(s), ${openIncidents.length} open incident(s), and ${highRiskFamilies.length} high-risk family profile(s) need review.`,
      counters: {
        activeBookings: activeBookings.length,
        breachedBookings: breachedBookings.length,
        watchBookings: watchBookings.length,
        openIncidents: openIncidents.length,
        highRiskFamilies: highRiskFamilies.length,
        watchFamilies: watchFamilies.length,
        openAlerts: openAlerts.length
      },
      recommendations,
      anomalySignals: [
        ...(breachedBookings.length ? ["care_sla_breach"] : []),
        ...(openIncidents.length ? ["open_incidents"] : []),
        ...(highRiskFamilies.length ? ["family_medical_high_risk"] : []),
        ...(watchReports.length ? ["visit_report_watch"] : [])
      ],
      model: "deterministic-free-ai-ops"
    };

    await database.ref(`aiOpsSummaries/byId/${summary.id}`).set(summary);

    return { ok: true as const, summary };
  },

  async cleanCaregiverNote({
    rawNote,
    serviceType = "Care visit",
    recipientName = "Parent"
  }: {
    rawNote: string;
    serviceType?: string;
    recipientName?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const cleaned = calmSentence(rawNote);
    const riskTags = riskTagsForNote(rawNote);
    const service = titleCase(serviceType.replace(/[-_]/g, " "));
    const id = `ai-note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const note = {
      id,
      rawNote,
      serviceType,
      recipientName,
      cleanedNote: cleaned,
      familyMessage: `${recipientName}'s ${service.toLowerCase()} update: ${cleaned}`,
      opsSummary: riskTags.length
        ? `Review needed for ${riskTags.join(", ")}.`
        : "No urgent risk words detected in caregiver note.",
      riskTags,
      model: "deterministic-free-ai-note-cleanup",
      createdAt: Date.now()
    };

    await database.ref(`aiCaregiverNotes/byId/${id}`).set(note);

    return { ok: true as const, note };
  }
};
