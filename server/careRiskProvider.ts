import { getAdminDatabase } from "./firebaseAdmin";
import type { CareBooking } from "../services/bookingService";
import type { CareProfile, CareRecipientProfile } from "../services/profileService";
import type { HealthSnapshot } from "../services/healthService";

type MedicationAdherenceRecord = {
  id: string;
  status?: "completed" | "due" | "missed" | "skipped";
  medicineName?: string;
  recordedAt?: number;
};

type IncidentRecord = {
  id: string;
  severity?: "low" | "medium" | "high" | "critical";
  category?: string;
  status?: string;
  createdAt?: number;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

const latest = <T extends { recordedAt?: number; createdAt?: number; updatedAt?: number }>(
  items: T[]
) =>
  [...items].sort(
    (a, b) =>
      (b.recordedAt || b.createdAt || b.updatedAt || 0) -
      (a.recordedAt || a.createdAt || a.updatedAt || 0)
  )[0] || null;

const primaryRecipientFor = (profile: CareProfile | null, relationship?: string) => {
  const recipients = Object.values(profile?.careRecipients || {});

  if (relationship) {
    return recipients.find((recipient) => recipient.relationship === relationship) || recipients[0] || null;
  }

  return recipients[0] || null;
};

const riskLevelFor = (score: number) => {
  if (score >= 75) {
    return "high";
  }

  if (score >= 45) {
    return "watch";
  }

  return "stable";
};

const riskFromProfile = (recipient: CareRecipientProfile | null, profile: CareProfile | null) => {
  const notes = `${recipient?.healthNotes || profile?.medicalNotes || ""} ${
    recipient?.mobility || ""
  }`.toLowerCase();
  const conditions = recipient?.medicalConditions || [];
  const riskFlags = [
    ...(recipient?.fallRisk === "high" ? ["High fall risk"] : []),
    ...(recipient?.fallRisk === "medium" ? ["Moderate fall risk"] : []),
    ...(recipient?.dementiaSupport || notes.includes("dementia") || notes.includes("memory")
      ? ["Dementia / memory support"]
      : []),
    ...(notes.includes("hypertension") || conditions.some((item) => item.toLowerCase().includes("hypertension"))
      ? ["Hypertension"]
      : []),
    ...(notes.includes("diabetes") || conditions.some((item) => item.toLowerCase().includes("diabetes"))
      ? ["Diabetes"]
      : []),
    ...(notes.includes("stroke") ? ["Stroke history"] : []),
    ...(recipient?.allergies && recipient.allergies.toLowerCase() !== "no known allergies"
      ? ["Allergy caution"]
      : [])
  ];

  return {
    riskFlags,
    score:
      (recipient?.fallRisk === "high" ? 18 : recipient?.fallRisk === "medium" ? 10 : 0) +
      (recipient?.dementiaSupport ? 14 : 0) +
      (riskFlags.includes("Hypertension") ? 8 : 0) +
      (riskFlags.includes("Diabetes") ? 8 : 0) +
      (riskFlags.includes("Allergy caution") ? 5 : 0)
  };
};

const riskFromHealth = (health: HealthSnapshot | null) => {
  if (!health) {
    return {
      score: 8,
      signals: ["Vitals not recently synced"],
      vitalsRisk: "watch" as const
    };
  }

  const oxygenRisk = health.vitals.oxygen < 94;
  const heartRisk = health.vitals.heartRate > 95 || health.vitals.heartRate < 55;
  const wellnessRisk = health.wellness === "urgent" || health.wellness === "watch";

  return {
    score:
      (oxygenRisk ? 22 : 0) +
      (heartRisk ? 14 : 0) +
      (wellnessRisk ? (health.wellness === "urgent" ? 20 : 10) : 0),
    signals: [
      ...(oxygenRisk ? [`Oxygen ${health.vitals.oxygen}% needs review`] : []),
      ...(heartRisk ? [`Heart rate ${health.vitals.heartRate} outside comfort range`] : []),
      ...(wellnessRisk ? [`Wellness is ${health.wellness}`] : [])
    ],
    vitalsRisk: oxygenRisk || heartRisk || health.wellness === "urgent" ? "high" : wellnessRisk ? "watch" : "stable"
  };
};

export const CareRiskProvider = {
  async getSummary({ userId, relationship = "" }: { userId: string; relationship?: string }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [profileSnapshot, healthSnapshot, medicationSnapshot, incidentSnapshot, bookingsSnapshot] =
      await Promise.all([
        database.ref(`profiles/${userId}`).get(),
        database.ref(`health/${userId}`).get(),
        database.ref("medicationAdherence/byId").get(),
        database.ref("incidents/byId").get(),
        database.ref("bookings/byId").get()
      ]);
    const profile = profileSnapshot.val() as CareProfile | null;
    const recipient = primaryRecipientFor(profile, relationship);
    const health = healthSnapshot.val() as HealthSnapshot | null;
    const medicationRecords = Object.values(
      (medicationSnapshot.val() || {}) as Record<string, MedicationAdherenceRecord>
    ).filter((record) => (record as MedicationAdherenceRecord & { userId?: string }).userId === userId);
    const incidentRecords = Object.values(
      (incidentSnapshot.val() || {}) as Record<string, IncidentRecord>
    ).filter((record) => (record as IncidentRecord & { userId?: string }).userId === userId);
    const activeBookings = Object.values(
      (bookingsSnapshot.val() || {}) as Record<string, CareBooking>
    ).filter(
      (booking) =>
        booking.customerId === userId &&
        !["completed", "payment_settled", "report_generated", "cancelled", "none"].includes(
          booking.status
        )
    );
    const latestMedication = latest(medicationRecords);
    const openIncidents = incidentRecords.filter((incident) => incident.status !== "resolved");
    const profileRisk = riskFromProfile(recipient, profile);
    const healthRisk = riskFromHealth(health);
    const medicationScore =
      latestMedication?.status === "missed"
        ? 22
        : latestMedication?.status === "skipped"
          ? 12
          : latestMedication?.status === "due"
            ? 8
            : 0;
    const incidentScore = openIncidents.reduce(
      (total, incident) =>
        total +
        (incident.severity === "critical"
          ? 28
          : incident.severity === "high"
            ? 18
            : incident.severity === "medium"
              ? 9
              : 4),
      0
    );
    const bookingScore = activeBookings.some((booking) => booking.sla?.status === "breached")
      ? 12
      : activeBookings.some((booking) => booking.sla?.status === "watch")
        ? 6
        : 0;
    const riskScore = clamp(
      profileRisk.score + healthRisk.score + medicationScore + incidentScore + bookingScore
    );
    const riskLevel = riskLevelFor(riskScore);
    const fallRisk =
      recipient?.fallRisk ||
      (openIncidents.some((incident) => incident.category === "fall_risk") ? "high" : "low");
    const emergencyReadinessScore = clamp(
      70 +
        (recipient?.emergencyContacts?.length ? 10 : 0) +
        (recipient?.phone ? 5 : 0) +
        (recipient?.address ? 5 : 0) -
        (riskLevel === "high" ? 15 : riskLevel === "watch" ? 6 : 0)
    );
    const recommendations = [
      ...(latestMedication?.status === "missed"
        ? ["Call caregiver or family to confirm the missed medicine dose."]
        : []),
      ...(fallRisk === "high" ? ["Use caregiver support for walks, stairs, and bathroom movement."] : []),
      ...(recipient?.dementiaSupport ? ["Keep visits familiar and repeat the same caregiver where possible."] : []),
      ...(openIncidents.length ? ["Review open incident notes before the next visit."] : []),
      ...(riskLevel === "stable" ? ["Continue normal care visibility and medicine reminders."] : [])
    ].slice(0, 4);

    const summary = {
      userId,
      recipientName: recipient?.fullName || profile?.elderName || "Parent",
      riskScore,
      riskLevel,
      fallRisk,
      dementiaSupport: Boolean(recipient?.dementiaSupport),
      chronicConditionFlags: profileRisk.riskFlags.filter((item) =>
        ["Hypertension", "Diabetes", "Stroke history"].includes(item)
      ),
      medicationRisk:
        latestMedication?.status === "missed"
          ? "missed"
          : latestMedication?.status === "skipped"
            ? "watch"
            : "stable",
      vitalsRisk: healthRisk.vitalsRisk,
      openIncidents: openIncidents.length,
      emergencyReadinessScore,
      missedCareSignals: [
        ...(latestMedication?.status === "missed"
          ? [`${latestMedication.medicineName || "Medicine"} missed`]
          : []),
        ...(activeBookings.some((booking) => booking.sla?.status === "breached")
          ? ["Care SLA breached"]
          : []),
        ...(openIncidents.length ? [`${openIncidents.length} open incident(s)`] : [])
      ],
      riskSignals: [...profileRisk.riskFlags, ...healthRisk.signals].slice(0, 8),
      recommendations,
      generatedAt: Date.now()
    };

    await database.ref(`careRisk/byUser/${userId}`).set(summary);

    return { ok: true as const, summary };
  }
};
