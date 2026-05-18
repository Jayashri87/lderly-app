import { getAdminDatabase } from "./firebaseAdmin";

type AuditLogRecord = {
  id?: string;
  action?: string;
  resource?: string;
  status?: "success" | "failure";
  details?: {
    actor?: string;
    targetType?: string;
    [key: string]: unknown;
  };
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  createdAt?: number;
};

type RecoveryActionRecord = {
  id?: string;
  bookingId?: string;
  action?: string;
  actor?: string;
  note?: string;
  outcome?: string;
  error?: string;
  createdAt?: number;
};

type CommandActionRecord = {
  id?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  note?: string;
  actor?: string;
  createdAt?: number;
};

type ReassignmentRecord = {
  bookingId?: string;
  previousCaretakerId?: string;
  nextCaretakerId?: string;
  reason?: string;
  createdAt?: number;
};

type OpsAlertRecord = {
  id?: string;
  kind?: string;
  title?: string;
  message?: string;
  bookingId?: string;
  severity?: string;
  status?: string;
  createdAt?: number;
};

type MaintenanceRunRecord = {
  id?: string;
  actor?: string;
  staleLocksRemoved?: number;
  expiredIdempotencyRemoved?: number;
  oldRecoverySignalsRemoved?: number;
  startedAt?: number;
  completedAt?: number;
};

export type OpsAuditEvent = {
  id: string;
  type: "api_audit" | "recovery" | "command" | "reassignment" | "alert" | "maintenance";
  title: string;
  subtitle: string;
  actor: string;
  status: string;
  severity: "low" | "medium" | "high" | "critical";
  bookingId: string;
  createdAt: number;
  metadata: Record<string, unknown>;
};

const normalizeObject = <T>(value: unknown) =>
  Object.entries((value || {}) as Record<string, T>).map(([id, item]) => ({
    ...(item || {}),
    id: (item as { id?: string })?.id || id
  })) as Array<T & { id: string }>;

const severityForAudit = (record: AuditLogRecord): OpsAuditEvent["severity"] => {
  if (record.status === "failure") {
    return "high";
  }

  if (`${record.action || ""}`.includes("emergency")) {
    return "critical";
  }

  if (`${record.action || ""}`.match(/recovery|refund|kyc|incident|command/)) {
    return "medium";
  }

  return "low";
};

const eventTime = (createdAt?: number) => createdAt || 0;

export const OpsAuditProvider = {
  async getSnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [
      auditSnapshot,
      recoverySnapshot,
      commandSnapshot,
      reassignmentSnapshot,
      alertSnapshot,
      maintenanceSnapshot
    ] = await Promise.all([
      database.ref("auditLogs").limitToLast(80).get(),
      database.ref("operations/recoveryActions").limitToLast(40).get(),
      database.ref("operations/commandCenter/actions").limitToLast(40).get(),
      database.ref("operations/reassignmentQueue/completed").limitToLast(40).get(),
      database.ref("operations/internalAlerts/byId").limitToLast(60).get(),
      database.ref("operations/maintenanceRuns").limitToLast(20).get()
    ]);

    const auditEvents: OpsAuditEvent[] = normalizeObject<AuditLogRecord>(auditSnapshot.val()).map(
      (record) => ({
        id: record.id,
        type: "api_audit",
        title: record.action || "API action",
        subtitle: `${record.method || "API"} ${record.path || record.resource || ""}`,
        actor: String(record.details?.actor || record.resource || "system"),
        status: record.status || "success",
        severity: severityForAudit(record),
        bookingId: record.resource || "",
        createdAt: eventTime(record.createdAt),
        metadata: {
          ip: record.ip,
          path: record.path,
          userAgent: record.userAgent,
          ...record.details
        }
      })
    );
    const recoveryEvents: OpsAuditEvent[] = normalizeObject<RecoveryActionRecord>(
      recoverySnapshot.val()
    ).map((record) => ({
      id: record.id,
      type: "recovery",
      title: `Recovery ${record.action || "action"}`,
      subtitle: record.note || record.error || "Recovery automation action",
      actor: record.actor || "ops",
      status: record.outcome || "recorded",
      severity: record.outcome === "escalated" || record.error ? "critical" : "medium",
      bookingId: record.bookingId || "",
      createdAt: eventTime(record.createdAt),
      metadata: record
    }));
    const commandEvents: OpsAuditEvent[] = normalizeObject<CommandActionRecord>(
      commandSnapshot.val()
    ).map((record) => ({
      id: record.id,
      type: "command",
      title: `Command ${record.action || "action"}`,
      subtitle: `${record.targetType || "target"} ${record.targetId || ""}`,
      actor: record.actor || "ops",
      status: "recorded",
      severity: record.action === "escalate_booking" ? "critical" : "medium",
      bookingId: record.targetType === "booking" ? record.targetId || "" : "",
      createdAt: eventTime(record.createdAt),
      metadata: record
    }));
    const reassignmentEvents: OpsAuditEvent[] = normalizeObject<ReassignmentRecord>(
      reassignmentSnapshot.val()
    ).map((record) => ({
      id: record.id,
      type: "reassignment",
      title: "Backup caregiver reassigned",
      subtitle: `${record.previousCaretakerId || "previous"} -> ${record.nextCaretakerId || "next"}`,
      actor: "ops",
      status: "completed",
      severity: "medium",
      bookingId: record.bookingId || record.id,
      createdAt: eventTime(record.createdAt),
      metadata: record
    }));
    const alertEvents: OpsAuditEvent[] = normalizeObject<OpsAlertRecord>(alertSnapshot.val()).map(
      (record) => ({
        id: record.id,
        type: "alert",
        title: record.title || record.kind || "Ops alert",
        subtitle: record.message || "Internal operations alert",
        actor: record.kind || "alert",
        status: record.status || "queued",
        severity: (record.severity as OpsAuditEvent["severity"]) || "medium",
        bookingId: record.bookingId || "",
        createdAt: eventTime(record.createdAt),
        metadata: record
      })
    );
    const maintenanceEvents: OpsAuditEvent[] = normalizeObject<MaintenanceRunRecord>(
      maintenanceSnapshot.val()
    )
      .filter((record) => record.id !== "latest")
      .map((record) => ({
        id: record.id,
        type: "maintenance",
        title: "Maintenance cleanup completed",
        subtitle: `${record.staleLocksRemoved || 0} locks, ${record.expiredIdempotencyRemoved || 0} replay records cleaned`,
        actor: record.actor || "ops",
        status: "completed",
        severity: "low",
        bookingId: "",
        createdAt: eventTime(record.completedAt || record.startedAt),
        metadata: record
      }));

    const events = [
      ...auditEvents,
      ...recoveryEvents,
      ...commandEvents,
      ...reassignmentEvents,
      ...alertEvents,
      ...maintenanceEvents
    ]
      .filter((event) => event.createdAt > 0)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 80);
    const criticalEvents = events.filter((event) => event.severity === "critical").length;
    const failedEvents = events.filter((event) => event.status === "failure").length;
    const automationEvents = events.filter((event) =>
      ["recovery", "command", "reassignment", "alert", "maintenance"].includes(event.type)
    ).length;

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        totalEvents: events.length,
        criticalEvents,
        failedEvents,
        automationEvents,
        events
      }
    };
  }
};
