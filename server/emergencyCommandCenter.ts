import { getAdminDatabase } from "./firebaseAdmin";
import { dispatchInternalOpsAlert } from "./internalOpsProvider";
import { filterProductionRecords } from "./productionHygiene";

const countRecord = (value: unknown) =>
  value && typeof value === "object" ? Object.keys(value as Record<string, unknown>).length : 0;

const countNested = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return 0;
  }

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, nested) => total + countRecord(nested),
    0
  );
};

type BookingRecord = {
  id: string;
  serviceType?: string;
  status?: string;
  customerId?: string;
  customerName?: string;
  caretakerId?: string;
  caretakerName?: string;
  createdAt?: number;
  scheduledFor?: number;
  updatedAt?: number;
  sla?: {
    status?: string;
    assignmentDueAt?: number;
    arrivalDueAt?: number;
    breachReason?: string;
  };
  matching?: {
    priority?: string;
    zone?: string;
  };
};

type EmergencyRecord = {
  id: string;
  userId?: string;
  bookingId?: string;
  reason?: string;
  locationLabel?: string;
  severity?: "high" | "critical";
  status?: string;
  currentStage?: string;
  createdAt?: number;
  updatedAt?: number;
  stages?: Array<{
    stage: string;
    status: string;
    dueAt?: number;
  }>;
};

type IncidentRecord = {
  id: string;
  userId?: string;
  caretakerId?: string;
  bookingId?: string;
  severity?: "low" | "medium" | "high" | "critical";
  category?: string;
  summary?: string;
  status?: string;
  createdAt?: number;
  updatedAt?: number;
};

type AlertRecord = {
  id?: string;
  kind?: string;
  severity?: string;
  title?: string;
  message?: string;
  bookingId?: string;
  status?: string;
  createdAt?: number;
};

const severityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const riskWeight: Record<string, number> = {
  breach: 4,
  breached: 4,
  critical: 4,
  high: 3,
  watch: 2,
  medium: 2,
  low: 1
};

const queueIds = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return new Set<string>();
  }

  return new Set(
    Object.values(value as Record<string, Record<string, unknown>>).flatMap((nested) =>
      nested && typeof nested === "object" ? Object.keys(nested) : []
    )
  );
};

const ageMinutes = (timestamp = Date.now()) =>
  Math.max(0, Math.round((Date.now() - timestamp) / 60000));

const dueMinutes = (timestamp?: number) =>
  timestamp ? Math.round((timestamp - Date.now()) / 60000) : 0;

const slaDelayMinutes = (booking: BookingRecord) => {
  const assignmentPending = ["requested", "searching"].includes(booking.status || "");
  const arrivalPending = ["assigned", "accepted", "en_route"].includes(booking.status || "");
  const dueAt = assignmentPending
    ? booking.sla?.assignmentDueAt
    : arrivalPending
      ? booking.sla?.arrivalDueAt
      : 0;

  return dueAt ? Math.max(0, Math.round((Date.now() - dueAt) / 60000)) : 0;
};

const normalizeBookings = (value: unknown) =>
  Object.entries((value || {}) as Record<string, BookingRecord>).map(([id, booking]) => ({
    ...booking,
    id: booking.id || id
  }));

const normalizeEmergencies = (value: unknown) =>
  Object.entries((value || {}) as Record<string, EmergencyRecord>).map(([id, escalation]) => ({
    ...escalation,
    id: escalation.id || id
  }));

const normalizeIncidents = (value: unknown) =>
  Object.entries((value || {}) as Record<string, IncidentRecord>).map(([id, incident]) => ({
    ...incident,
    id: incident.id || id
  }));

const normalizeAlerts = (value: unknown) =>
  Object.entries((value || {}) as Record<string, AlertRecord>).map(([id, alert]) => ({
    ...alert,
    id: alert.id || id
  }));

export const EmergencyCommandCenter = {
  async getSnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [
      emergencyQueueSnapshot,
      incidentQueueSnapshot,
      partnerDispatchSnapshot,
      activeBookingsSnapshot,
      internalAlertsSnapshot,
      emergencyRecordsSnapshot,
      incidentRecordsSnapshot
    ] = await Promise.all([
      database.ref("operations/emergencyQueue").get(),
      database.ref("operations/incidentQueue").get(),
      database.ref("operations/partnerDispatchQueue").get(),
      database.ref("bookings/byId").get(),
      database.ref("operations/internalAlerts/byId").get(),
      database.ref("emergencyEscalations/byId").get(),
      database.ref("incidents/byId").get()
    ]);

    const emergencyIds = queueIds(emergencyQueueSnapshot.val());
    const incidentIds = queueIds(incidentQueueSnapshot.val());
    const bookings = filterProductionRecords(normalizeBookings(activeBookingsSnapshot.val()));
    const emergencies = filterProductionRecords(
      normalizeEmergencies(emergencyRecordsSnapshot.val())
    ).filter((item) => emergencyIds.has(item.id) || item.status === "active");
    const incidents = filterProductionRecords(normalizeIncidents(incidentRecordsSnapshot.val()))
      .filter((item) => incidentIds.has(item.id) || item.status === "open");
    const internalAlerts = filterProductionRecords(normalizeAlerts(internalAlertsSnapshot.val()));
    const criticalBookings = bookings.filter(
      (booking) =>
        booking.matching?.priority === "critical" ||
        booking.sla?.status === "breached" ||
        booking.status === "cancelled"
    ).length;
    const emergencyCount = countNested(emergencyQueueSnapshot.val());
    const incidentCount = countNested(incidentQueueSnapshot.val());
    const partnerDispatchCount = countNested(partnerDispatchSnapshot.val());
    const openAlerts = internalAlerts.filter((alert) => alert.status !== "resolved").length;
    const delayedBookings = bookings
      .filter(
        (booking) =>
          !["completed", "payment_settled", "report_generated", "cancelled", "none"].includes(
            booking.status || ""
          ) &&
          (["watch", "breached"].includes(booking.sla?.status || "") ||
            slaDelayMinutes(booking) > 0)
      )
      .map((booking) => ({
        id: booking.id,
        type: "booking" as const,
        severity:
          booking.sla?.status === "breached" || booking.matching?.priority === "critical"
            ? "critical"
            : "high",
        title: booking.serviceType || "Care booking",
        subtitle: `${booking.customerName || "Customer"} - ${booking.status || "active"}`,
        status: booking.status || "active",
        bookingId: booking.id,
        customerName: booking.customerName || "Customer",
        caretakerName: booking.caretakerName || "Unassigned",
        ageMinutes: ageMinutes(booking.createdAt),
        dueInMinutes: dueMinutes(
          ["requested", "searching"].includes(booking.status || "")
            ? booking.sla?.assignmentDueAt
            : booking.sla?.arrivalDueAt
        ),
        risk: booking.sla?.status === "breached" ? "breach" : "watch",
        nextAction:
          booking.caretakerId && booking.sla?.status === "breached"
            ? "Reassign backup caregiver"
            : "Assign caregiver and notify family"
      }));
    const emergencyQueue = emergencies
      .map((emergency) => {
        const activeStage = emergency.stages?.find((stage) => stage.status === "active");

        return {
          id: emergency.id,
          type: "emergency" as const,
          severity: emergency.severity || "critical",
          title: emergency.reason || "Emergency escalation",
          subtitle: emergency.locationLabel || "Care location",
          status: emergency.status || "active",
          bookingId: emergency.bookingId || "",
          customerName: emergency.userId || "Family",
          currentStage: emergency.currentStage || activeStage?.stage || "customer",
          ageMinutes: ageMinutes(emergency.createdAt),
          dueInMinutes: dueMinutes(activeStage?.dueAt),
          risk: emergency.severity === "critical" ? "critical" : "high",
          nextAction: "Advance escalation and confirm family update"
        };
      })
      .sort(
        (a, b) =>
          (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0) ||
          b.ageMinutes - a.ageMinutes
      );
    const panicQueue = emergencyQueue.filter((item) =>
      `${item.title} ${item.subtitle}`.toLowerCase().match(/panic|sos|unsafe|fall|distress/)
    );
    const incidentQueue = incidents
      .map((incident) => ({
        id: incident.id,
        type: "incident" as const,
        severity: incident.severity || "medium",
        title: incident.summary || "Care incident",
        subtitle: `${incident.category || "incident"} - ${incident.status || "open"}`,
        status: incident.status || "open",
        bookingId: incident.bookingId || "",
        customerName: incident.userId || "Customer",
        caretakerName: incident.caretakerId || "Caregiver",
        ageMinutes: ageMinutes(incident.createdAt),
        dueInMinutes: incident.severity === "critical" ? 0 : incident.severity === "high" ? 10 : 30,
        risk:
          incident.severity === "critical"
            ? "critical"
            : incident.severity === "high"
              ? "high"
              : "watch",
        nextAction:
          incident.severity === "critical"
            ? "Call family and assign ops owner"
            : "Review incident notes and follow up"
      }))
      .sort(
        (a, b) =>
          (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0) ||
          b.ageMinutes - a.ageMinutes
      );
    const alertQueue = internalAlerts
      .filter((alert) => alert.status !== "resolved")
      .map((alert) => ({
        id: alert.id || "",
        type: "alert" as const,
        severity: alert.severity || "medium",
        title: alert.title || alert.kind || "Ops alert",
        subtitle: alert.message || "Internal alert",
        status: alert.status || "queued",
        bookingId: alert.bookingId || "",
        ageMinutes: ageMinutes(alert.createdAt),
        dueInMinutes: alert.severity === "critical" ? 0 : alert.severity === "high" ? 5 : 20,
        risk: alert.severity || "watch",
        nextAction: "Acknowledge alert and assign owner"
      }));
    const commandQueue = [
      ...emergencyQueue,
      ...incidentQueue,
      ...delayedBookings,
      ...alertQueue
    ]
      .sort(
        (a, b) =>
          (riskWeight[b.risk] || 0) - (riskWeight[a.risk] || 0) ||
          b.ageMinutes - a.ageMinutes
      )
      .slice(0, 12);
    const commandLevel =
      emergencyQueue.length > 0 || panicQueue.length > 0 || criticalBookings > 0
        ? "red"
        : incidentQueue.length > 0 || delayedBookings.length > 0 || openAlerts > 0
          ? "amber"
          : "green";

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        commandLevel,
        emergencyCount,
        incidentCount,
        partnerDispatchCount,
        criticalBookings,
        openAlerts,
        panicCount: panicQueue.length,
        delayedBookingCount: delayedBookings.length,
        queues: {
          command: commandQueue,
          emergency: emergencyQueue,
          panic: panicQueue,
          incidents: incidentQueue,
          delayedBookings,
          alerts: alertQueue
        },
        escalationOrder: ["Customer", "Family", "Ops team", "Ambulance", "Hospital"],
        nextAction:
          commandLevel === "red"
            ? "Open emergency queue and assign ops owner now."
            : commandLevel === "amber"
              ? "Review incident and SLA watch queues."
              : "No emergency action needed. Keep monitoring live care."
      }
    };
  },

  async recordAction({
    action,
    targetType,
    targetId,
    note,
    actor
  }: {
    action:
      | "acknowledge"
      | "resolve_incident"
      | "escalate_booking"
      | "advance_emergency"
      | "resolve_alert";
    targetType: "alert" | "booking" | "emergency" | "incident";
    targetId: string;
    note?: string;
    actor: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const now = Date.now();
    const actionRecord = {
      id: `command-action-${now}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      targetType,
      targetId,
      note: note || "",
      actor,
      createdAt: now
    };
    const updates: Record<string, unknown> = {
      [`operations/commandCenter/actions/${actionRecord.id}`]: actionRecord,
      [`operations/commandCenter/acknowledged/${targetType}/${targetId}`]: actionRecord
    };

    if (action === "resolve_incident" && targetType === "incident") {
      const incidentSnapshot = await database.ref(`incidents/byId/${targetId}`).get();
      const incident = incidentSnapshot.val() as IncidentRecord | null;

      updates[`incidents/byId/${targetId}/status`] = "resolved";
      updates[`incidents/byId/${targetId}/updatedAt`] = now;

      if (incident?.severity) {
        updates[`operations/incidentQueue/${incident.severity}/${targetId}`] = null;
      }
    }

    if (action === "escalate_booking" && targetType === "booking") {
      updates[`bookings/byId/${targetId}/matching/priority`] = "critical";
      updates[`bookings/byId/${targetId}/sla/status`] = "breached";
      updates[`bookings/byId/${targetId}/sla/breachReason`] =
        note || "Escalated by operations command center";
      updates[`bookings/byId/${targetId}/updatedAt`] = now;

      const alertResult = await dispatchInternalOpsAlert({
        kind: "sla_breach",
        title: "Booking escalated by command center",
        message: note || `Ops escalated booking ${targetId}`,
        bookingId: targetId,
        severity: "critical"
      });

      actionRecord.note = `${actionRecord.note}${
        alertResult.alert?.id ? ` alert:${alertResult.alert.id}` : ""
      }`;
    }

    if (action === "advance_emergency" && targetType === "emergency") {
      const emergencySnapshot = await database.ref(`emergencyEscalations/byId/${targetId}`).get();
      const emergency = emergencySnapshot.val() as EmergencyRecord | null;
      const stages = emergency?.stages || [];
      const activeIndex = stages.findIndex((stage) => stage.status === "active");
      const nextIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
      const nextStage = stages[nextIndex]?.stage || "ops_team";

      if (activeIndex >= 0) {
        updates[`emergencyEscalations/byId/${targetId}/stages/${activeIndex}/status`] = "done";
      }

      if (stages[nextIndex]) {
        updates[`emergencyEscalations/byId/${targetId}/stages/${nextIndex}/status`] = "active";
        updates[`emergencyEscalations/byId/${targetId}/stages/${nextIndex}/dueAt`] = now + 5 * 60 * 1000;
      }

      updates[`emergencyEscalations/byId/${targetId}/status`] = "active";
      updates[`emergencyEscalations/byId/${targetId}/currentStage`] = nextStage;
      updates[`emergencyEscalations/byId/${targetId}/updatedAt`] = now;
      updates[`operations/emergencyQueue/critical/${targetId}`] = true;

      const alertResult = await dispatchInternalOpsAlert({
        kind: "emergency",
        title: "Emergency response advanced",
        message: note || `Ops advanced emergency ${targetId} to ${nextStage}`,
        bookingId: emergency?.bookingId || targetId,
        severity: "critical"
      });

      actionRecord.note = `${actionRecord.note}${
        alertResult.alert?.id ? ` alert:${alertResult.alert.id}` : ""
      }`;
    }

    if (action === "resolve_alert" && targetType === "alert") {
      updates[`operations/internalAlerts/byId/${targetId}/status`] = "resolved";
      updates[`operations/internalAlerts/byId/${targetId}/updatedAt`] = now;
    }

    await database.ref().update(updates);

    return { ok: true as const, action: actionRecord };
  }
};
