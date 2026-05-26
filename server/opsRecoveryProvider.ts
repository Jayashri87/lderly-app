import type { CareBooking } from "../services/bookingService";
import { getAdminDatabase } from "./firebaseAdmin";
import { dispatchInternalOpsAlert } from "./internalOpsProvider";
import { filterProductionRecords } from "./productionHygiene";
import { TrustedBooking } from "./trustedBooking";

type RecoveryKind =
  | "assignment_stuck"
  | "arrival_delayed"
  | "dispatch_offer_expired"
  | "visit_start_delayed"
  | "completion_verification_delayed"
  | "emergency_unresolved";

type RecoverySeverity = "watch" | "breach" | "critical";

export type RecoverySignal = {
  id: string;
  bookingId: string;
  kind: RecoveryKind;
  severity: RecoverySeverity;
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

type EmergencyRecord = {
  id: string;
  bookingId?: string;
  status?: string;
  reason?: string;
  severity?: "high" | "critical";
  createdAt?: number;
  currentStage?: string;
  stages?: Array<{
    stage: string;
    status: string;
    dueAt?: number;
  }>;
};

const terminalStatuses = new Set(["payment_settled", "report_generated", "cancelled", "none"]);

const normalizeBookings = (value: unknown) =>
  Object.entries((value || {}) as Record<string, CareBooking>).map(([id, booking]) => ({
    ...booking,
    id: booking.id || id
  }));

const normalizeEmergencies = (value: unknown) =>
  Object.entries((value || {}) as Record<string, EmergencyRecord>).map(([id, emergency]) => ({
    ...emergency,
    id: emergency.id || id
  }));

const minutesPast = (timestamp?: number) =>
  timestamp ? Math.max(0, Math.round((Date.now() - timestamp) / 60000)) : 0;

const severityFor = (delayMinutes: number, priority?: string): RecoverySeverity => {
  if (priority === "critical" || delayMinutes >= 20) {
    return "critical";
  }

  if (delayMinutes >= 8) {
    return "breach";
  }

  return "watch";
};

const signalForBooking = (booking: CareBooking): RecoverySignal | null => {
  const completionPending =
    booking.status === "completed" &&
    booking.completion?.paymentReleaseStatus === "awaiting_customer";

  if (terminalStatuses.has(booking.status) || (booking.status === "completed" && !completionPending)) {
    return null;
  }

  const assignmentPending = ["requested", "searching"].includes(booking.status);
  const arrivalPending = ["assigned", "accepted", "en_route"].includes(booking.status);
  const visitStartPending = booking.status === "arrived";
  const assignmentDelay = assignmentPending ? minutesPast(booking.sla?.assignmentDueAt) : 0;
  const arrivalDelay = arrivalPending ? minutesPast(booking.sla?.arrivalDueAt) : 0;
  const visitStartDelay = visitStartPending ? minutesPast((booking.updatedAt || 0) + 15 * 60 * 1000) : 0;
  const dispatchExpired =
    booking.status === "searching" &&
    Boolean(booking.dispatch?.offerExpiresAt && Date.now() > booking.dispatch.offerExpiresAt);
  const completionDelay = completionPending
    ? minutesPast((booking.completion?.caretakerMarkedDoneAt || booking.updatedAt || 0) + 15 * 60 * 1000)
    : 0;

  if (dispatchExpired) {
    const delayMinutes = minutesPast(booking.dispatch?.offerExpiresAt);

    return {
      id: `recovery-${booking.id}-dispatch-expired`,
      bookingId: booking.id,
      kind: "dispatch_offer_expired",
      severity: severityFor(delayMinutes, booking.matching?.priority),
      status: booking.status,
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      caretakerName: "No caregiver accepted",
      delayMinutes,
      recommendedAction: "rebroadcast_caregivers",
      reason: "Nearby caregiver offers expired without acceptance.",
      createdAt: Date.now()
    };
  }

  if (assignmentPending && (assignmentDelay > 0 || booking.sla?.status === "breached")) {
    const delayMinutes = Math.max(assignmentDelay, booking.sla?.status === "breached" ? 1 : 0);

    return {
      id: `recovery-${booking.id}-assignment`,
      bookingId: booking.id,
      kind: "assignment_stuck",
      severity: severityFor(delayMinutes, booking.matching?.priority),
      status: booking.status,
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      caretakerName: booking.caretakerName || "Unassigned",
      delayMinutes,
      recommendedAction: "assign_caregiver",
      reason: "No caregiver has been assigned within the SLA window.",
      createdAt: Date.now()
    };
  }

  if (arrivalPending && (arrivalDelay > 0 || booking.sla?.status === "breached")) {
    const delayMinutes = Math.max(arrivalDelay, booking.sla?.status === "breached" ? 1 : 0);

    return {
      id: `recovery-${booking.id}-arrival`,
      bookingId: booking.id,
      kind: "arrival_delayed",
      severity: severityFor(delayMinutes, booking.matching?.priority),
      status: booking.status,
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      caretakerName: booking.caretakerName || "Assigned caregiver",
      delayMinutes,
      recommendedAction: booking.caretakerId ? "reassign_backup" : "assign_caregiver",
      reason: booking.caretakerId
        ? "Assigned caregiver has missed the expected arrival SLA."
        : "Booking is delayed and still has no caregiver.",
      createdAt: Date.now()
    };
  }

  if (visitStartPending && visitStartDelay > 0) {
    return {
      id: `recovery-${booking.id}-visit-start`,
      bookingId: booking.id,
      kind: "visit_start_delayed",
      severity: severityFor(visitStartDelay, booking.matching?.priority),
      status: booking.status,
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      caretakerName: booking.caretakerName || "Arrived caregiver",
      delayMinutes: visitStartDelay,
      recommendedAction: "escalate_ops",
      reason: "Caregiver arrived but the visit has not started within 15 minutes.",
      createdAt: Date.now()
    };
  }

  if (completionPending && completionDelay > 0) {
    return {
      id: `recovery-${booking.id}-completion-verify`,
      bookingId: booking.id,
      kind: "completion_verification_delayed",
      severity: severityFor(completionDelay, booking.matching?.priority),
      status: booking.status,
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      caretakerName: booking.caretakerName || "Caregiver",
      delayMinutes: completionDelay,
      recommendedAction: "nudge_customer",
      reason: "Caregiver marked the visit complete but family has not verified payment release.",
      createdAt: Date.now()
    };
  }

  return null;
};

const signalForEmergency = (emergency: EmergencyRecord): RecoverySignal | null => {
  if (emergency.status !== "active") {
    return null;
  }

  const activeStage = emergency.stages?.find((stage) => stage.status === "active");
  const delayMinutes = minutesPast(activeStage?.dueAt);

  if (delayMinutes <= 0 && emergency.severity !== "critical") {
    return null;
  }

  return {
    id: `recovery-${emergency.id}-emergency`,
    bookingId: emergency.bookingId || emergency.id,
    kind: "emergency_unresolved",
    severity: emergency.severity === "critical" || delayMinutes >= 5 ? "critical" : "breach",
    status: emergency.currentStage || activeStage?.stage || "active",
    serviceType: emergency.reason || "Emergency escalation",
    customerName: emergency.id,
    caretakerName: "Ops escalation",
    delayMinutes,
    recommendedAction: "advance_emergency",
    reason: "Emergency escalation stage is overdue or critical.",
    createdAt: Date.now()
  };
};

const queueUpdatesFor = (signals: RecoverySignal[]) => {
  const updates: Record<string, unknown> = {};

  for (const signal of signals) {
    updates[`operations/recoveryQueue/byId/${signal.id}`] = signal;
    updates[`operations/recoveryQueue/bySeverity/${signal.severity}/${signal.id}`] = true;
    updates[`operations/recoveryQueue/byBooking/${signal.bookingId}/${signal.id}`] = true;
  }

  return updates;
};

const writeRecoveryAction = async (
  action: {
    bookingId: string;
    action: string;
    actor: string;
    note?: string;
    outcome: "resolved" | "escalated" | "failed";
    error?: string;
  },
  cleanupSignals: RecoverySignal[] = []
) => {
  const database = getAdminDatabase();

  if (!database) {
    return "";
  }

  const id = `recovery-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const updates: Record<string, unknown> = {
    [`operations/recoveryActions/${id}`]: {
      id,
      ...action,
      createdAt: Date.now()
    }
  };

  for (const signal of cleanupSignals) {
    updates[`operations/recoveryQueue/byId/${signal.id}`] = null;
    updates[`operations/recoveryQueue/bySeverity/${signal.severity}/${signal.id}`] = null;
    updates[`operations/recoveryQueue/byBooking/${signal.bookingId}/${signal.id}`] = null;
  }

  await database.ref().update(updates);
  return id;
};

export const OpsRecoveryProvider = {
  async getSnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [bookingsSnapshot, emergenciesSnapshot] = await Promise.all([
      database.ref("bookings/byId").get(),
      database.ref("emergencyEscalations/byId").get()
    ]);
    const bookingSignals = filterProductionRecords(normalizeBookings(bookingsSnapshot.val()))
      .map(signalForBooking)
      .filter(Boolean) as RecoverySignal[];
    const emergencySignals = filterProductionRecords(normalizeEmergencies(emergenciesSnapshot.val()))
      .map(signalForEmergency)
      .filter(Boolean) as RecoverySignal[];
    const signals = [...bookingSignals, ...emergencySignals].sort(
      (a, b) =>
        (b.severity === "critical" ? 3 : b.severity === "breach" ? 2 : 1) -
          (a.severity === "critical" ? 3 : a.severity === "breach" ? 2 : 1) ||
        b.delayMinutes - a.delayMinutes
    );

    await database.ref().update({
      "operations/recoveryQueue/byId": null,
      "operations/recoveryQueue/bySeverity": null,
      "operations/recoveryQueue/byBooking": null
    });

    if (signals.length > 0) {
      await database.ref().update(queueUpdatesFor(signals));
    }

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        openSignals: signals.length,
        criticalSignals: signals.filter((signal) => signal.severity === "critical").length,
        assignmentStuck: signals.filter((signal) => signal.kind === "assignment_stuck").length,
        dispatchOfferExpired: signals.filter((signal) => signal.kind === "dispatch_offer_expired").length,
        arrivalDelayed: signals.filter((signal) => signal.kind === "arrival_delayed").length,
        visitStartDelayed: signals.filter((signal) => signal.kind === "visit_start_delayed").length,
        completionVerificationDelayed: signals.filter(
          (signal) => signal.kind === "completion_verification_delayed"
        ).length,
        emergencyUnresolved: signals.filter((signal) => signal.kind === "emergency_unresolved").length,
        signals: signals.slice(0, 250)
      }
    };
  },

  async recoverBooking({
    bookingId,
    actor,
    note
  }: {
    bookingId: string;
    actor: string;
    note?: string;
  }) {
    const snapshotResult = await this.getSnapshot();

    if (!snapshotResult.ok) {
      return snapshotResult;
    }

    const signals = snapshotResult.snapshot.signals.filter(
      (signal) => signal.bookingId === bookingId
    );
    const primarySignal = signals[0];

    if (!primarySignal) {
      await writeRecoveryAction({
        bookingId,
        action: "noop",
        actor,
        note: note || "No active recovery signal found.",
        outcome: "resolved"
      });
      return {
        ok: true as const,
        action: {
          action: "noop",
          outcome: "resolved",
          bookingId
        }
      };
    }

    const action =
      primarySignal.recommendedAction === "assign_caregiver"
        ? "assign"
        : primarySignal.recommendedAction === "rebroadcast_caregivers"
          ? "rebroadcast"
        : primarySignal.recommendedAction === "reassign_backup"
          ? "reassign"
          : primarySignal.recommendedAction === "nudge_customer"
            ? "nudge_customer"
          : "escalate";
    const result =
      action === "assign"
        ? await TrustedBooking.assign(bookingId)
        : action === "rebroadcast"
          ? await TrustedBooking.rebroadcast(bookingId, "Recovery automation rebroadcast")
        : action === "reassign"
          ? await TrustedBooking.reassign(bookingId)
          : action === "nudge_customer"
            ? await TrustedBooking.nudgeCompletionVerification(bookingId)
            : { ok: false as const, status: 409, error: "Manual escalation required" };

    if (result.ok) {
      const actionId = await writeRecoveryAction(
        {
          bookingId,
          action,
          actor,
          note: note || primarySignal.reason,
          outcome: "resolved"
        },
        signals
      );

      return {
        ok: true as const,
        action: {
          id: actionId,
          action,
          outcome: "resolved",
          bookingId
        },
        booking: result.booking
      };
    }

    const database = getAdminDatabase();
    await database?.ref(`bookings/byId/${bookingId}`).update({
      "matching/priority": "critical",
      "sla/status": "breached",
      "sla/breachReason": result.error || "Recovery automation could not resolve booking.",
      updatedAt: Date.now()
    });

    const alertResult = await dispatchInternalOpsAlert({
      kind: "sla_breach",
      title: "Recovery automation needs manual owner",
      message: `${primarySignal.serviceType}: ${result.error || "Manual recovery required"}`,
      bookingId,
      severity: "critical"
    });
    const actionId = await writeRecoveryAction({
      bookingId,
      action,
      actor,
      note: `${note || primarySignal.reason}${alertResult.alert?.id ? ` alert:${alertResult.alert.id}` : ""}`,
      outcome: "escalated",
      error: result.error
    });

    return {
      ok: true as const,
      action: {
        id: actionId,
        action,
        outcome: "escalated",
        bookingId,
        alertId: alertResult.alert?.id || ""
      }
    };
  }
};
