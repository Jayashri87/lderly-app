import { getAdminDatabase } from "./firebaseAdmin";

type ReportRecord = {
  id: string;
  userId: string;
  bookingId?: string;
  serviceType: string;
  reportType: string;
  familySummary: string;
  caregiverNote: string;
  vitalsSummary: string;
  medicineSummary: string;
};

const riskFor = (report: ReportRecord) => {
  const combined = `${report.vitalsSummary} ${report.medicineSummary} ${report.caregiverNote}`.toLowerCase();

  if (
    combined.includes("missed") ||
    combined.includes("abnormal") ||
    combined.includes("incident") ||
    combined.includes("fall")
  ) {
    return "watch";
  }

  return "stable";
};

const nextBestActionFor = (report: ReportRecord) => {
  const service = report.serviceType.toLowerCase();

  if (service.includes("doctor")) {
    return "Share doctor notes with the family and confirm the next follow-up date.";
  }

  if (service.includes("medicine")) {
    return "Keep the next medicine reminder active and watch for missed doses.";
  }

  if (service.includes("lab") || service.includes("report")) {
    return "Notify the family when reports are available and attach them to the care timeline.";
  }

  if (service.includes("hospital")) {
    return "Keep discharge, nurse instructions, and family handover visible to ops.";
  }

  return "Send the family a calm visit summary and rebook suggestion if needed.";
};

export const ReportIntelligence = {
  async generateSummary(reportId: string) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const reportSnapshot = await database.ref(`reports/byId/${reportId}`).get();
    const report = reportSnapshot.val() as ReportRecord | null;

    if (!report) {
      return { ok: false as const, status: 404, error: "Report not found" };
    }

    const riskLevel = riskFor(report);
    const summary = {
      id: `ai-summary-${reportId}`,
      reportId,
      userId: report.userId,
      bookingId: report.bookingId || "",
      serviceType: report.serviceType,
      riskLevel,
      familyHeadline:
        riskLevel === "watch"
          ? "A follow-up may be needed"
          : "Care looks stable after this visit",
      familyMessage:
        riskLevel === "watch"
          ? `${report.familySummary} I noticed one item that may need family attention.`
          : `${report.familySummary} Nothing urgent stands out from this visit.`,
      caregiverQualitySignal: report.caregiverNote,
      nextBestAction: nextBestActionFor(report),
      generatedBy: "lderly-ai-placeholder",
      generatedAt: Date.now()
    };

    await database.ref().update({
      [`aiSummaries/byReport/${reportId}`]: summary,
      [`aiSummaries/byUser/${report.userId}/${reportId}`]: summary,
      [`reports/byId/${reportId}/aiSummary`]: summary,
      [`reports/byUser/${report.userId}/${reportId}/aiSummary`]: summary
    });

    return {
      ok: true as const,
      summary
    };
  }
};
