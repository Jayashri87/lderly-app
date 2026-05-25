import { getAdminDatabase } from "./firebaseAdmin";
import { GoogleWorkspaceProvider } from "./googleWorkspaceProvider";

type ReportRecord = {
  id: string;
  serviceType: string;
  familySummary: string;
  completedAt: number;
  aiSummary?: {
    riskLevel?: string;
    nextBestAction?: string;
  };
};

export const MonthlyReportProvider = {
  async generate({
    userId,
    month
  }: {
    userId: string;
    month?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const monthKey = month || new Date().toISOString().slice(0, 7);
    const reportsSnapshot = await database.ref(`reports/byUser/${userId}`).get();
    const reports = Object.values(
      (reportsSnapshot.val() || {}) as Record<string, ReportRecord>
    )
      .filter((report) => {
        const reportMonth = new Date(report.completedAt).toISOString().slice(0, 7);
        return reportMonth === monthKey;
      })
      .sort((a, b) => a.completedAt - b.completedAt);
    const services = reports.reduce<Record<string, number>>((result, report) => {
      result[report.serviceType] = (result[report.serviceType] || 0) + 1;
      return result;
    }, {});
    const watchCount = reports.filter((report) => report.aiSummary?.riskLevel === "watch").length;
    const topNextActions = reports
      .map((report) => report.aiSummary?.nextBestAction)
      .filter((action): action is string => Boolean(action))
      .slice(0, 5);
    const mostUsedService =
      Object.entries(services).sort((a, b) => b[1] - a[1])[0]?.[0] || "No visits yet";
    const id = `monthly-${userId}-${monthKey}`;
    const monthlyReport = {
      id,
      userId,
      month: monthKey,
      totalVisits: reports.length,
      serviceBreakdown: services,
      wellnessSignal: watchCount ? "watch" : "stable",
      familyHeadline: reports.length
        ? `${reports.length} care updates summarized for family`
        : "No completed visits found for this month",
      aiNarrative: reports.length
        ? watchCount
          ? `${watchCount} visit(s) need follow-up. Most care activity was ${mostUsedService}.`
          : `Care looked stable this month. Most care activity was ${mostUsedService}.`
        : "No completed visits were found, so the family report is ready as an empty-month check-in.",
      anomalySignals: [
        ...(watchCount ? ["watch_visit_reports"] : []),
        ...(reports.length === 0 ? ["no_completed_visits"] : []),
        ...(Object.keys(services).length >= 3 ? ["multi_service_coordination"] : [])
      ],
      topNextActions,
      highlights: reports.slice(0, 5).map((report) => ({
        reportId: report.id,
        serviceType: report.serviceType,
        summary: report.familySummary,
        nextBestAction: report.aiSummary?.nextBestAction || "Continue normal care visibility"
      })),
      pdfStatus: "placeholder_ready",
      pdfUrl: "",
      generatedAt: Date.now()
    };

    const googleDoc = await GoogleWorkspaceProvider.createMonthlyReportDoc(monthlyReport);
    const googleReportLedger = await GoogleWorkspaceProvider.appendReportToOpsSheet(
      monthlyReport,
      "monthly_report_generated",
      googleDoc
    );
    const reportWithIntegrations = {
      ...monthlyReport,
      googleDocStatus: googleDoc.ok ? "synced" : "not_synced",
      googleDocId: googleDoc.ok ? googleDoc.id || "" : "",
      googleDocUrl: googleDoc.ok ? googleDoc.url || "" : "",
      integrations: {
        googleDocs: {
          provider: "google_workspace",
          status: googleDoc.ok ? "synced" : "not_synced",
          updatedAt: Date.now(),
          ...(googleDoc.ok
            ? { docId: googleDoc.id || "", docUrl: googleDoc.url || "" }
            : { error: googleDoc.error, httpStatus: googleDoc.status })
        }
      },
      googleReportLedger: {
        provider: "google_workspace",
        status: googleReportLedger.ok ? "synced" : "not_synced",
        updatedAt: Date.now(),
        ...(googleReportLedger.ok
          ? { range: googleReportLedger.id || "", url: googleReportLedger.url || "" }
          : { error: googleReportLedger.error, httpStatus: googleReportLedger.status })
      }
    };

    await database.ref().update({
      [`monthlyReports/byId/${id}`]: reportWithIntegrations,
      [`monthlyReports/byUser/${userId}/${monthKey}`]: reportWithIntegrations
    });

    return { ok: true as const, monthlyReport: reportWithIntegrations };
  }
};
