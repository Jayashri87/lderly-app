import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAdminDatabase, hasFirebaseAdminConfig } from "./firebaseAdmin";

type ReadinessCheck = {
  id: string;
  label: string;
  ready: boolean;
  severity: "blocker" | "warning" | "info";
  detail: string;
};

const hasEnv = (name: string) => Boolean(process.env[name]);
const appCheckConfigured = () => hasEnv("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY");
const appCheckEnforced = () => process.env.LDERLY_ENFORCE_APP_CHECK === "true";
const rulesDeployed = () =>
  process.env.FIREBASE_RULES_DEPLOYED === "true" ||
  existsSync(join(process.cwd(), ".firebase-rules-deployed.json"));
const ageHours = (timestamp?: number) =>
  timestamp ? Math.round(((Date.now() - timestamp) / (60 * 60 * 1000)) * 10) / 10 : null;

export const ProductionReadinessProvider = {
  async getSnapshot() {
    const database = getAdminDatabase();
    const [backupSnapshot, maintenanceSnapshot] = database
      ? await Promise.all([
          database.ref("operations/backups/latest").get(),
          database.ref("operations/maintenanceRuns/latest").get()
        ])
      : [null, null];
    const latestBackup = backupSnapshot?.val() as { createdAt?: number; id?: string } | null;
    const latestMaintenance = maintenanceSnapshot?.val() as
      | { completedAt?: number; id?: string }
      | null;
    const backupAgeHours = ageHours(latestBackup?.createdAt);
    const maintenanceAgeHours = ageHours(latestMaintenance?.completedAt);
    const checks: ReadinessCheck[] = [
      {
        id: "firebase-admin",
        label: "Firebase Admin trusted backend",
        ready: hasFirebaseAdminConfig,
        severity: "blocker",
        detail: hasFirebaseAdminConfig
          ? "Server-owned writes are active."
          : "Configure Firebase Admin service account before launch."
      },
      {
        id: "firebase-rules",
        label: "Strict Firebase rules deployed",
        ready: rulesDeployed(),
        severity: "blocker",
        detail: rulesDeployed()
          ? "Rules deployment marker is present."
          : "Deploy strict Realtime Database rules before launch."
      },
      {
        id: "signed-sessions",
        label: "Signed auth sessions",
        ready: hasEnv("LDERLY_AUTH_SECRET"),
        severity: "blocker",
        detail: hasEnv("LDERLY_AUTH_SECRET")
          ? "Signed cookie secret is configured."
          : "Set LDERLY_AUTH_SECRET."
      },
      {
        id: "ops-maintenance",
        label: "Recent ops maintenance run",
        ready: Boolean(maintenanceAgeHours !== null && maintenanceAgeHours <= 26),
        severity: "warning",
        detail:
          maintenanceAgeHours === null
            ? "No maintenance run recorded yet."
            : `Latest maintenance is ${maintenanceAgeHours} hours old.`
      },
      {
        id: "backup-manifest",
        label: "Recent backup manifest",
        ready: Boolean(backupAgeHours !== null && backupAgeHours <= 26),
        severity: "warning",
        detail:
          backupAgeHours === null
            ? "No backup manifest recorded yet."
            : `Latest backup manifest is ${backupAgeHours} hours old.`
      },
      {
        id: "cron-secret",
        label: "Scheduled maintenance secret",
        ready: hasEnv("CRON_SECRET"),
        severity: "warning",
        detail: hasEnv("CRON_SECRET")
          ? "CRON_SECRET is configured."
          : "Set CRON_SECRET so Vercel Cron can run maintenance securely."
      },
      {
        id: "maps",
        label: "Google Maps production config",
        ready: hasEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY") && hasEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID"),
        severity: "warning",
        detail: "Map key and Map ID are required for Uber-style live tracking."
      },
      {
        id: "observability",
        label: "Production observability",
        ready: hasEnv("SENTRY_DSN") || hasEnv("NEXT_PUBLIC_POSTHOG_KEY"),
        severity: "warning",
        detail: "Sentry or PostHog should be configured for production issue visibility."
      },
      {
        id: "app-check-configured",
        label: "Firebase App Check configured",
        ready: appCheckConfigured(),
        severity: "warning",
        detail: appCheckConfigured()
          ? "App Check site key is configured."
          : "Configure Firebase App Check before public traffic."
      },
      {
        id: "app-check-enforced",
        label: "Firebase App Check API enforcement",
        ready: appCheckConfigured() && appCheckEnforced(),
        severity: "warning",
        detail:
          appCheckConfigured() && appCheckEnforced()
            ? "Protected API routes require Firebase App Check tokens."
            : "Set LDERLY_ENFORCE_APP_CHECK=true after validating client App Check tokens."
      }
    ];
    const blockers = checks.filter((check) => check.severity === "blocker" && !check.ready);
    const warnings = checks.filter((check) => check.severity === "warning" && !check.ready);

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        goLiveReady: blockers.length === 0,
        blockerCount: blockers.length,
        warningCount: warnings.length,
        latestBackupId: latestBackup?.id || "",
        latestMaintenanceId: latestMaintenance?.id || "",
        checks
      }
    };
  }
};
