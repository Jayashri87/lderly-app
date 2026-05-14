import { getAdminDatabase } from "./firebaseAdmin";
import type { CareBooking, CaretakerMatchProfile } from "../services/bookingService";
import type { VisitReport } from "../services/reportService";

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

const trustScoreFor = (caretaker: Partial<CaretakerMatchProfile>) =>
  clamp(
    ((caretaker.rating || 4.5) / 5) * 28 +
      ((caretaker.punctualityScore || 85) / 100) * 22 +
      Math.min(caretaker.repeatVisits || 0, 20) +
      (caretaker.verified ? 14 : 0) +
      (caretaker.trained ? 10 : 0) +
      Math.min(caretaker.yearsExperience || 0, 10)
  );

const serviceProofSignals = (booking: CareBooking | null, report: VisitReport | null) => {
  const service = `${booking?.serviceType || report?.serviceType || ""}`.toLowerCase();

  if (service.includes("doctor")) {
    return ["Appointment timing", "Doctor notes", "Prescription handover", "Family summary"];
  }

  if (service.includes("lab") || service.includes("report")) {
    return ["Lab receipt", "Test/report status", "Collection timestamp", "Family handover"];
  }

  if (service.includes("medicine")) {
    return ["Prescription check", "Medicine photo", "Dosage note", "Bill handover"];
  }

  if (service.includes("temple") || service.includes("walk") || service.includes("birthday")) {
    return ["Arrival proof", "Comfort check", "Mood note", "Voice summary"];
  }

  return ["Arrival proof", "Task note", "Caregiver summary", "Family update"];
};

export const TrustProvider = {
  async caregiverProfile(caretakerId: string) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref(`caretakers/${caretakerId}`).get();
    const caretaker = snapshot.val() as Partial<CaretakerMatchProfile> | null;

    if (!caretaker) {
      return { ok: false as const, status: 404, error: "Caregiver not found" };
    }

    const trustScore = trustScoreFor(caretaker);

    return {
      ok: true as const,
      profile: {
        uid: caretaker.uid || caretakerId,
        name: caretaker.name || "Caregiver",
        photoUrl: "",
        status: caretaker.status || (caretaker.available ? "available" : "offline"),
        trustScore,
        rating: caretaker.rating || 0,
        punctualityScore: caretaker.punctualityScore || 0,
        repeatVisits: caretaker.repeatVisits || 0,
        yearsExperience: caretaker.yearsExperience || 0,
        languages: caretaker.languages || [],
        skills: caretaker.skills || [],
        badges: [
          caretaker.verified ? "ID verified" : "ID pending",
          caretaker.verified ? "Police checked" : "Police check pending",
          caretaker.trained ? "Trained caregiver" : "Training pending",
          `${caretaker.yearsExperience || 0} years experience`
        ],
        signals: [
          `${trustScore}% trust score`,
          `${caretaker.punctualityScore || 0}% punctuality`,
          `${caretaker.repeatVisits || 0} repeat visits`,
          `${caretaker.languages?.slice(0, 2).join(", ") || "Language pending"}`
        ]
      }
    };
  },

  async visitProof(bookingId: string) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [bookingSnapshot, reportsSnapshot] = await Promise.all([
      database.ref(`bookings/byId/${bookingId}`).get(),
      database.ref("reports/byId").get()
    ]);
    const booking = bookingSnapshot.val() as CareBooking | null;
    const reports = Object.values(
      (reportsSnapshot.val() || {}) as Record<string, VisitReport>
    ).filter((report) => report.bookingId === bookingId);
    const report = reports.sort((a, b) => b.completedAt - a.completedAt)[0] || null;

    if (!booking && !report) {
      return { ok: false as const, status: 404, error: "Visit proof not found" };
    }

    const timestamp = report?.completedAt || booking?.updatedAt || Date.now();
    const locationLabel =
      booking?.tracking?.destinationLabel || booking?.requestDetails?.location?.label || "Care location";

    return {
      ok: true as const,
      proof: {
        bookingId,
        status: report ? "verified" : "pending",
        serviceType: booking?.serviceType || report?.serviceType || "Care visit",
        caretakerName: booking?.caretakerName || report?.caretakerName || "Caregiver",
        completedAt: report?.completedAt || null,
        timestampLabel: new Date(timestamp).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short"
        }),
        locationLabel,
        gpsVerified: Boolean(booking?.tracking?.customerLocation),
        timestampVerified: Boolean(timestamp),
        reportReady: Boolean(report),
        vitalsSummary: report?.vitalsSummary || "Vitals will be added after the visit",
        medicineSummary: report?.medicineSummary || "Medicine notes pending",
        familySummary: report?.familySummary || "Family handover will appear after completion",
        caregiverNote: report?.caregiverNote || "Caregiver note pending",
        proofSignals: serviceProofSignals(booking, report),
        attachments:
          report?.attachments?.length
            ? report.attachments
            : [
                { label: "Visit photo", status: "pending" as const },
                { label: "Voice summary", status: "pending" as const }
              ]
      }
    };
  }
};
