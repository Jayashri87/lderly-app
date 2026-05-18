import { getAdminDatabase } from "./firebaseAdmin";

type CountedPath = {
  key: string;
  path: string;
};

const countedPaths: CountedPath[] = [
  { key: "bookings", path: "bookings/byId" },
  { key: "caretakers", path: "caretakers" },
  { key: "customers", path: "users" },
  { key: "reports", path: "reports/byId" },
  { key: "notifications", path: "notifications/byId" },
  { key: "auditLogs", path: "auditLogs" },
  { key: "supportTickets", path: "supportTickets/byId" },
  { key: "refunds", path: "refunds/byId" },
  { key: "incidents", path: "careQuality/incidents/byId" }
];

const countChildren = (value: unknown) => Object.keys((value || {}) as Record<string, unknown>).length;

export const OpsBackupProvider = {
  async createManifest({ actor = "ops" }: { actor?: string } = {}) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshots = await Promise.all(
      countedPaths.map(async (item) => ({
        ...item,
        snapshot: await database.ref(item.path).get()
      }))
    );
    const counts = Object.fromEntries(
      snapshots.map((item) => [item.key, countChildren(item.snapshot.val())])
    );
    const manifest = {
      id: `backup-manifest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor,
      mode: "rtdb-manifest",
      status: "ready_for_external_export",
      counts,
      requiredExportPaths: countedPaths.map((item) => item.path),
      createdAt: Date.now()
    };

    await database.ref().update({
      [`operations/backups/manifests/${manifest.id}`]: manifest,
      "operations/backups/latest": manifest
    });

    return {
      ok: true as const,
      manifest
    };
  },

  async getLatest() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("operations/backups/latest").get();

    return {
      ok: true as const,
      manifest: snapshot.val()
    };
  }
};
