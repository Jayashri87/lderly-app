import { getAdminDatabase } from "./firebaseAdmin";
import { cleanupExpiredSessions } from "./sessionRegistry";

type MaintenanceRecord = {
  id: string;
  actor: string;
  staleLocksRemoved: number;
  expiredIdempotencyRemoved: number;
  expiredSessionsRemoved: number;
  oldRecoverySignalsRemoved: number;
  startedAt: number;
  completedAt: number;
};

const normalizeObject = <T>(value: unknown) =>
  Object.entries((value || {}) as Record<string, T>).map(([id, item]) => ({
    ...(item || {}),
    id
  })) as Array<T & { id: string }>;

const removeUpdatesFor = (path: string, records: Array<{ id: string }>) =>
  Object.fromEntries(records.map((record) => [`${path}/${record.id}`, null]));

export const OpsMaintenanceProvider = {
  async run({
    actor = "ops",
    now = Date.now()
  }: {
    actor?: string;
    now?: number;
  } = {}) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const startedAt = Date.now();
    const [lockSnapshot, idempotencySnapshot, recoverySnapshot] = await Promise.all([
      database.ref("operations/locks/bookings").get(),
      database.ref("operations/idempotency").get(),
      database.ref("operations/recoveryQueue/byId").get()
    ]);
    const staleLocks = normalizeObject<{ expiresAt?: number }>(lockSnapshot.val()).filter(
      (lock) => Number(lock.expiresAt || 0) <= now
    );
    const expiredIdempotency = normalizeObject<{ expiresAt?: number }>(
      idempotencySnapshot.val()
    ).filter((operation) => Number(operation.expiresAt || 0) <= now);
    const oldRecoverySignals = normalizeObject<{ createdAt?: number }>(
      recoverySnapshot.val()
    ).filter(
      (signal) =>
        Number(signal.createdAt || 0) > 0 && Number(signal.createdAt) < now - 24 * 60 * 60 * 1000
    );
    const expiredSessionsRemoved = await cleanupExpiredSessions();
    const recordId = `maintenance-${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    const record: MaintenanceRecord = {
      id: recordId,
      actor,
      staleLocksRemoved: staleLocks.length,
      expiredIdempotencyRemoved: expiredIdempotency.length,
      expiredSessionsRemoved,
      oldRecoverySignalsRemoved: oldRecoverySignals.length,
      startedAt,
      completedAt: Date.now()
    };
    const updates: Record<string, unknown> = {
      ...removeUpdatesFor("operations/locks/bookings", staleLocks),
      ...removeUpdatesFor("operations/idempotency", expiredIdempotency),
      ...removeUpdatesFor("operations/recoveryQueue/byId", oldRecoverySignals),
      [`operations/maintenanceRuns/${recordId}`]: record,
      "operations/maintenanceRuns/latest": record
    };

    await database.ref().update(updates);

    return {
      ok: true as const,
      record
    };
  },

  async latest() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("operations/maintenanceRuns/latest").get();

    return {
      ok: true as const,
      record: snapshot.val()
    };
  }
};
