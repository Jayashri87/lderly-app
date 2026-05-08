import { onValue, ref, update } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";
import { CareBooking } from "./bookingService";
import { CareJourney } from "./journeyService";
import { HealthSnapshot } from "./healthService";
import { NotificationService } from "./notificationService";

export type VisitReport = {
  id: string;
  userId: string;
  bookingId?: string;
  journeyId?: string;
  caretakerName: string;
  serviceType: string;
  visitType: "booking" | "emergency";
  reportType:
    | "doctor_visit"
    | "lab_support"
    | "hospital_attender"
    | "medicine_help"
    | "companionship"
    | "daily_support"
    | "general_care"
    | "immediate_assistance";
  summary: string;
  vitalsSummary: string;
  medicineSummary: string;
  familySummary: string;
  caregiverNote: string;
  attachments: Array<{
    label: string;
    status: "pending" | "uploaded" | "not_required";
  }>;
  completedAt: number;
};

const storageKey = "lderly-visit-reports";
const now = () => Date.now();

let localReports: VisitReport[] = [];
const localSubscribers = new Set<(reports: VisitReport[]) => void>();

const canUseStorage = () => typeof window !== "undefined";

const readLocalReports = () => {
  if (!canUseStorage()) {
    return localReports;
  }

  const storedReports = window.localStorage.getItem(storageKey);

  if (!storedReports) {
    return localReports;
  }

  try {
    localReports = JSON.parse(storedReports) as VisitReport[];
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return localReports;
};

const writeLocalReports = (reports: VisitReport[]) => {
  localReports = reports;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(reports));
  }

  localSubscribers.forEach((callback) => callback(reports));
};

const normalizeService = (serviceType: string) => serviceType.toLowerCase();

const reportPlanFor = (
  serviceType: string,
  visitType: VisitReport["visitType"]
): Pick<VisitReport, "reportType" | "familySummary" | "caregiverNote"> & {
  attachments: string[];
} => {
  const service = normalizeService(serviceType);

  if (visitType === "emergency" || service.includes("immediate")) {
    return {
      reportType: "immediate_assistance",
      familySummary: "Immediate assistance was handled and the family was updated.",
      caregiverNote: "The request was treated as urgent and monitored through completion.",
      attachments: ["Incident note", "Voice summary"]
    };
  }

  if (service.includes("doctor")) {
    return {
      reportType: "doctor_visit",
      familySummary: "Doctor visit support completed with notes ready for review.",
      caregiverNote: "Appointment, waiting, consultation, and follow-up points were tracked.",
      attachments: ["Prescription", "Doctor notes", "Clinic bill", "Voice summary"]
    };
  }

  if (service.includes("lab") || service.includes("report")) {
    return {
      reportType: "lab_support",
      familySummary: "Lab support completed and report-related follow-up is tracked.",
      caregiverNote: "Lab appointment, test status, and report collection steps were updated.",
      attachments: ["Lab receipt", "Lab report", "Voice summary"]
    };
  }

  if (service.includes("hospital")) {
    return {
      reportType: "hospital_attender",
      familySummary: "Hospital attender support completed with family handover.",
      caregiverNote: "Hospital desk, nurse/doctor notes, comfort support, and discharge readiness were tracked.",
      attachments: ["Hospital bill", "Discharge summary", "Prescription", "Voice summary"]
    };
  }

  if (service.includes("medicine") || service.includes("recovery")) {
    return {
      reportType: "medicine_help",
      familySummary: "Medicine support completed and schedule details were shared.",
      caregiverNote: "Prescription, pickup, dosage timing, and recovery observations were checked.",
      attachments: ["Prescription", "Medicine bill", "Medicine photo", "Voice summary"]
    };
  }

  if (
    service.includes("temple") ||
    service.includes("birthday") ||
    service.includes("festival") ||
    service.includes("occasion") ||
    service.includes("conversation") ||
    service.includes("walk")
  ) {
    return {
      reportType: "companionship",
      familySummary: "Companionship visit completed with a calm family update.",
      caregiverNote: "Conversation, mobility, comfort, and mood were observed during the visit.",
      attachments: ["Visit photo", "Voice summary"]
    };
  }

  if (service.includes("meal") || service.includes("errand")) {
    return {
      reportType: "daily_support",
      familySummary: "Daily support task completed and family was updated.",
      caregiverNote: "Meal, errand, and home check-in details were noted.",
      attachments: ["Receipt", "Task photo", "Voice summary"]
    };
  }

  return {
    reportType: "general_care",
    familySummary: "Care session completed and family was updated.",
    caregiverNote: "Caregiver completed the requested care task.",
    attachments: ["Photo", "Voice summary"]
  };
};

const summaryForService = (serviceType: string, customerName: string) =>
  `${serviceType} completed for ${customerName}.`;

export const ReportService = {
  subscribe(session: SessionUser, callback: (reports: VisitReport[]) => void) {
    callback(readLocalReports());
    localSubscribers.add(callback);

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
      };
    }

    const reportsRef =
      session.role === "admin" ? ref(db, "reports/byId") : ref(db, `reports/byUser/${session.uid}`);
    const unsubscribe = onValue(
      reportsRef,
      (snapshot) => {
        const records = snapshot.val() as Record<string, VisitReport> | null;
        const nextReports = records
          ? Object.values(records).sort((a, b) => b.completedAt - a.completedAt)
          : readLocalReports();
        writeLocalReports(nextReports);
      },
      () => {
        callback(readLocalReports());
      }
    );

    return () => {
      localSubscribers.delete(callback);
      unsubscribe();
    };
  },

  createFromBooking(booking: CareBooking | null, health: HealthSnapshot | null) {
    if (!booking || booking.status === "none") {
      return;
    }

    this.create({
      userId: booking.customerId,
      caretakerName: booking.caretakerName,
      serviceType: booking.serviceType,
      visitType: "booking",
      sourceId: booking.id,
      summary: summaryForService(booking.serviceType, booking.customerName),
      health
    });
  },

  createFromJourney(journey: CareJourney | null, health: HealthSnapshot | null) {
    if (!journey || journey.status === "idle") {
      return;
    }

    this.create({
      userId: journey.customerId,
      caretakerName: journey.caretakerName,
      serviceType: journey.serviceType,
      visitType: "emergency",
      sourceId: journey.id,
      summary: summaryForService(journey.serviceType, journey.customerName),
      health
    });
  },

  create({
    userId,
    caretakerName,
    serviceType,
    visitType,
    sourceId,
    summary,
    health
  }: {
    userId: string;
    caretakerName: string;
    serviceType: string;
    visitType: VisitReport["visitType"];
    sourceId?: string;
    summary: string;
    health: HealthSnapshot | null;
  }) {
    const id = `report-${now()}`;
    const reportPlan = reportPlanFor(serviceType, visitType);
    const report: VisitReport = {
      id,
      userId,
      ...(visitType === "booking" && sourceId ? { bookingId: sourceId } : {}),
      ...(visitType === "emergency" && sourceId ? { journeyId: sourceId } : {}),
      caretakerName: caretakerName || "Caretaker",
      serviceType,
      visitType,
      reportType: reportPlan.reportType,
      summary,
      vitalsSummary: health
        ? `HR ${health.vitals.heartRate}, BP ${health.vitals.bloodPressure}, O2 ${health.vitals.oxygen}%`
        : "Vitals not recorded",
      medicineSummary: health
        ? `Medicine ${health.medicineStatus}`
        : "Medicine status not recorded",
      familySummary: reportPlan.familySummary,
      caregiverNote: reportPlan.caregiverNote,
      attachments: reportPlan.attachments.map((label) => ({
        label,
        status: label.includes("Voice") ? "pending" : "not_required"
      })),
      completedAt: now()
    };
    const nextReports = [report, ...readLocalReports()].slice(0, 10);

    writeLocalReports(nextReports);
    NotificationService.create({
      userId,
      role: "all",
      title: "Visit report ready",
      body: `${serviceType} report is available for family review.`,
      priority: "normal"
    });

    if (!db) {
      return;
    }

    update(ref(db), {
      [`reports/byId/${id}`]: report,
      [`reports/byUser/${userId}/${id}`]: report
    }).catch(() => {
      writeLocalReports(nextReports);
    });
  }
};
