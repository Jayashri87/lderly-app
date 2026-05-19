import { AuditRetentionProvider } from "./auditRetentionProvider";
import { OpsBackupProvider } from "./opsBackupProvider";
import { OpsMaintenanceProvider } from "./opsMaintenanceProvider";
import { OpsRecoveryProvider } from "./opsRecoveryProvider";
import { ProductionReadinessProvider } from "./productionReadinessProvider";

type RunbookStep = {
  id: string;
  title: string;
  owner: "ops" | "engineering" | "finance" | "care-team";
  priority: "blocker" | "high" | "medium";
  action: string;
};

export const OpsRunbookProvider = {
  async getSnapshot() {
    const [readiness, recovery, backup, maintenance, auditRetention] = await Promise.all([
      ProductionReadinessProvider.getSnapshot(),
      OpsRecoveryProvider.getSnapshot(),
      OpsBackupProvider.getLatest(),
      OpsMaintenanceProvider.latest(),
      AuditRetentionProvider.latest()
    ]);
    const readinessSnapshot = readiness.snapshot;
    const recoverySnapshot = recovery.ok ? recovery.snapshot : null;
    const backupManifest = backup.ok ? backup.manifest : null;
    const auditManifest = auditRetention.ok ? auditRetention.manifest : null;
    const blockerChecks = readinessSnapshot.checks.filter(
      (check) => check.severity === "blocker" && !check.ready
    );
    const warningChecks = readinessSnapshot.checks.filter(
      (check) => check.severity === "warning" && !check.ready
    );
    const steps: RunbookStep[] = [
      ...blockerChecks.map((check) => ({
        id: `fix-${check.id}`,
        title: check.label,
        owner: "engineering" as const,
        priority: "blocker" as const,
        action: check.detail
      })),
      ...warningChecks.slice(0, 4).map((check) => ({
        id: `review-${check.id}`,
        title: check.label,
        owner: check.id.includes("backup") || check.id.includes("maintenance") ? "ops" as const : "engineering" as const,
        priority: "high" as const,
        action: check.detail
      }))
    ];

    if ((recoverySnapshot?.criticalSignals || 0) > 0) {
      steps.unshift({
        id: "resolve-critical-recovery",
        title: "Resolve critical recovery queue",
        owner: "ops",
        priority: "blocker",
        action: `${recoverySnapshot?.criticalSignals} critical care operations signal(s) need manual owner before launch.`
      });
    }

    steps.push(
      {
        id: "rollback-vercel",
        title: "Rollback latest Vercel deployment",
        owner: "engineering",
        priority: "medium",
        action: "Use Vercel Deployments, promote the previous healthy deployment, then rerun /api/ops/readiness and smoke tests."
      },
      {
        id: "rollback-firebase-rules",
        title: "Rollback Firebase rules",
        owner: "engineering",
        priority: "medium",
        action: "Redeploy the last known good firebase.rules.json and verify customer/caretaker/admin access boundaries."
      },
      {
        id: "incident-comms",
        title: "Incident communication",
        owner: "care-team",
        priority: "medium",
        action: "For care-impacting incidents, call affected families first, then send WhatsApp/SMS update after human confirmation."
      }
    );

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        launchState:
          blockerChecks.length > 0 || (recoverySnapshot?.criticalSignals || 0) > 0
            ? "blocked"
            : warningChecks.length > 0
              ? "watch"
              : "ready",
        blockerCount: blockerChecks.length,
        warningCount: warningChecks.length,
        criticalRecoverySignals: recoverySnapshot?.criticalSignals || 0,
        latestBackupId: backupManifest?.id || "",
        latestMaintenanceId: maintenance.ok ? maintenance.record?.id || "" : "",
        latestAuditRetentionId: auditManifest?.id || "",
        steps
      }
    };
  }
};
