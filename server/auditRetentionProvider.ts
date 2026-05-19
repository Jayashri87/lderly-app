import { getAdminDatabase } from "./firebaseAdmin";

type AuditRecord = {
  id?: string;
  action?: string;
  status?: "success" | "failure";
  createdAt?: number;
  resource?: string;
};

const retentionDaysFor = (record: AuditRecord) => {
  const action = `${record.action || ""}`.toLowerCase();

  if (record.status === "failure" || action.match(/emergency|payment|refund|kyc|incident/)) {
    return 365;
  }

  if (action.match(/booking|auth|session|recovery|maintenance|backup/)) {
    return 180;
  }

  return 90;
};

const normalizeAudit = (value: unknown) =>
  Object.entries((value || {}) as Record<string, AuditRecord>).map(([id, record]) => ({
    ...record,
    id: record.id || id
  }));

export const AuditRetentionProvider = {
  async run({ actor = "ops", now = Date.now() }: { actor?: string; now?: number } = {}) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("auditLogs").get();
    const records = normalizeAudit(snapshot.val());
    const archive: Record<string, AuditRecord & { retentionDays: number; archivedAt: number }> = {};
    const updates: Record<string, unknown> = {};

    for (const record of records) {
      const createdAt = Number(record.createdAt || 0);
      const retentionDays = retentionDaysFor(record);
      const expired = createdAt > 0 && createdAt < now - retentionDays * 24 * 60 * 60 * 1000;

      if (!expired) {
        continue;
      }

      archive[record.id] = {
        ...record,
        retentionDays,
        archivedAt: now
      };
      updates[`auditLogs/${record.id}`] = null;
    }

    const runId = `audit-retention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const manifest = {
      id: runId,
      actor,
      scanned: records.length,
      archived: Object.keys(archive).length,
      policy: {
        defaultDays: 90,
        operationalDays: 180,
        criticalDays: 365
      },
      createdAt: Date.now()
    };

    updates[`operations/auditRetention/runs/${runId}`] = manifest;
    updates["operations/auditRetention/latest"] = manifest;

    if (Object.keys(archive).length > 0) {
      updates[`operations/auditRetention/archive/${runId}`] = archive;
    }

    await database.ref().update(updates);

    return {
      ok: true as const,
      manifest
    };
  },

  async latest() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("operations/auditRetention/latest").get();

    return {
      ok: true as const,
      manifest: snapshot.val()
    };
  }
};
