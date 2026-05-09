import { getAdminDatabase } from "./firebaseAdmin";

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

    await database.ref().update({
      [`monthlyReports/byId/${id}`]: monthlyReport,
      [`monthlyReports/byUser/${userId}/${monthKey}`]: monthlyReport
    });

    return { ok: true as const, monthlyReport };
  }
};
