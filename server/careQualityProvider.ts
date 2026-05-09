import { getAdminDatabase } from "./firebaseAdmin";
import { dispatchInternalOpsAlert } from "./internalOpsProvider";
import { PushProvider } from "./pushProvider";

export type MedicationStatus = "completed" | "due" | "missed" | "skipped";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export const CareQualityProvider = {
  async upsertMedicationSchedule({
    userId,
    recipientName,
    medicines
  }: {
    userId: string;
    recipientName: string;
    medicines: Array<{
      name: string;
      dosage: string;
      time: string;
      instructions?: string;
    }>;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `med-schedule-${userId}-${Date.now()}`;
    const schedule = {
      id,
      userId,
      recipientName,
      medicines,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`medicationSchedules/byId/${id}`]: schedule,
      [`medicationSchedules/byUser/${userId}/${id}`]: true,
      [`health/${userId}/nextMedicine`]: medicines[0]?.time || "Not set",
      [`health/${userId}/medicineStatus`]: "due",
      [`health/${userId}/updatedAt`]: Date.now()
    });

    return { ok: true as const, schedule };
  },

  async recordMedicationAdherence({
    userId,
    scheduleId,
    medicineName,
    status,
    note = "",
    bookingId = ""
  }: {
    userId: string;
    scheduleId?: string;
    medicineName: string;
    status: MedicationStatus;
    note?: string;
    bookingId?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `med-adherence-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      id,
      userId,
      scheduleId: scheduleId || "",
      bookingId,
      medicineName,
      status,
      note,
      recordedAt: Date.now()
    };

    await database.ref().update({
      [`medicationAdherence/byId/${id}`]: record,
      [`medicationAdherence/byUser/${userId}/${id}`]: true,
      ...(bookingId ? { [`medicationAdherence/byBooking/${bookingId}/${id}`]: true } : {}),
      [`health/${userId}/medicineStatus`]: status,
      [`health/${userId}/wellness`]: status === "missed" ? "watch" : "stable",
      [`health/${userId}/updatedAt`]: Date.now()
    });

    if (status === "missed") {
      await dispatchInternalOpsAlert({
        kind: "ai_risk",
        title: "Medicine missed",
        message: `${medicineName} was marked missed. Follow up with family/caregiver.`,
        bookingId,
        severity: "high"
      });
      await PushProvider.dispatchToUser({
        userId,
        title: "Medicine follow-up needed",
        body: `${medicineName} was marked missed. LDERLY ops has been notified.`,
        data: {
          bookingId,
          link: "/"
        }
      });
    }

    return { ok: true as const, adherence: record };
  },

  async createIncident({
    userId,
    caretakerId,
    bookingId,
    severity,
    category,
    summary
  }: {
    userId: string;
    caretakerId?: string;
    bookingId?: string;
    severity: IncidentSeverity;
    category: "fall_risk" | "medical" | "safety" | "service" | "other";
    summary: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `incident-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const incident = {
      id,
      userId,
      caretakerId: caretakerId || "",
      bookingId: bookingId || "",
      severity,
      category,
      summary,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`incidents/byId/${id}`]: incident,
      [`incidents/byUser/${userId}/${id}`]: true,
      ...(bookingId ? { [`incidents/byBooking/${bookingId}/${id}`]: true } : {}),
      [`operations/incidentQueue/${severity}/${id}`]: true
    });

    await dispatchInternalOpsAlert({
      kind: "incident",
      title: "Care incident reported",
      message: summary,
      bookingId,
      severity: severity === "critical" ? "critical" : severity === "high" ? "high" : "medium"
    });

    return { ok: true as const, incident };
  },

  async awardTrainingBadge({
    caretakerId,
    badgeId,
    title,
    expiresAt
  }: {
    caretakerId: string;
    badgeId: string;
    title: string;
    expiresAt?: number;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const badge = {
      badgeId,
      title,
      status: "active",
      issuedAt: Date.now(),
      expiresAt: expiresAt || null
    };

    await database.ref().update({
      [`trainingBadges/byCaretaker/${caretakerId}/${badgeId}`]: badge,
      [`trainingBadges/byBadge/${badgeId}/${caretakerId}`]: true,
      [`caretakers/${caretakerId}/trainingBadges/${badgeId}`]: badge
    });

    return { ok: true as const, badge };
  }
};
