import { getAdminDatabase } from "./firebaseAdmin";
import { dispatchInternalOpsAlert } from "./internalOpsProvider";
import { PushProvider } from "./pushProvider";

export type EmergencyEscalationStage =
  | "ambulance"
  | "customer"
  | "family"
  | "hospital"
  | "ops";

export type EmergencyEscalationInput = {
  userId: string;
  bookingId?: string;
  reason: string;
  locationLabel?: string;
  severity?: "high" | "critical";
};

const stages: Array<{
  stage: EmergencyEscalationStage;
  dueInMinutes: number;
}> = [
  { stage: "customer", dueInMinutes: 0 },
  { stage: "family", dueInMinutes: 2 },
  { stage: "ops", dueInMinutes: 4 },
  { stage: "ambulance", dueInMinutes: 7 },
  { stage: "hospital", dueInMinutes: 10 }
];

export const EmergencyEscalation = {
  async create(input: EmergencyEscalationInput) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `emergency-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const severity = input.severity || "critical";
    const escalation = {
      id,
      userId: input.userId,
      bookingId: input.bookingId || "",
      reason: input.reason,
      locationLabel: input.locationLabel || "Care location",
      severity,
      status: "active",
      currentStage: "customer" as EmergencyEscalationStage,
      stages: stages.map((stage) => ({
        ...stage,
        status: stage.dueInMinutes === 0 ? "active" : "pending",
        dueAt: now + stage.dueInMinutes * 60 * 1000,
        completedAt: null
      })),
      createdAt: now,
      updatedAt: now
    };

    await database.ref().update({
      [`emergencyEscalations/byId/${id}`]: escalation,
      [`emergencyEscalations/byUser/${input.userId}/${id}`]: true,
      [`operations/emergencyQueue/${severity}/${id}`]: true
    });

    await dispatchInternalOpsAlert({
      kind: "emergency",
      title: "Emergency escalation started",
      message: `${input.reason} at ${escalation.locationLabel}`,
      bookingId: input.bookingId,
      severity
    });

    await PushProvider.dispatchToUser({
      userId: input.userId,
      title: "Emergency assistance activated",
      body: "LDERLY ops has started the escalation flow and will keep family updated.",
      data: {
        escalationId: id,
        link: "/"
      }
    });

    return { ok: true as const, escalation };
  },

  async advance({
    escalationId,
    stage,
    note
  }: {
    escalationId: string;
    stage: EmergencyEscalationStage;
    note?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref(`emergencyEscalations/byId/${escalationId}`).get();
    const escalation = snapshot.val() as
      | {
          userId: string;
          severity: string;
          stages: Array<{
            stage: EmergencyEscalationStage;
            status: string;
          }>;
        }
      | null;

    if (!escalation) {
      return { ok: false as const, status: 404, error: "Escalation not found" };
    }

    const now = Date.now();
    const nextStages = escalation.stages.map((item) =>
      item.stage === stage
        ? {
            ...item,
            status: "completed",
            completedAt: now,
            note: note || ""
          }
        : item
    );
    const nextStage =
      nextStages.find((item) => item.status === "pending")?.stage || stage;
    const complete = !nextStages.some((item) => item.status === "pending");

    await database.ref().update({
      [`emergencyEscalations/byId/${escalationId}/stages`]: nextStages,
      [`emergencyEscalations/byId/${escalationId}/currentStage`]: nextStage,
      [`emergencyEscalations/byId/${escalationId}/status`]: complete
        ? "resolved"
        : "active",
      [`emergencyEscalations/byId/${escalationId}/updatedAt`]: now,
      ...(complete
        ? {
            [`operations/emergencyQueue/${escalation.severity}/${escalationId}`]: null
          }
        : {})
    });

    return {
      ok: true as const,
      escalation: {
        id: escalationId,
        currentStage: nextStage,
        status: complete ? "resolved" : "active"
      }
    };
  }
};
