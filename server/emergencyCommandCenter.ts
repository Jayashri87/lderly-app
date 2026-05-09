import { getAdminDatabase } from "./firebaseAdmin";

const countRecord = (value: unknown) =>
  value && typeof value === "object" ? Object.keys(value as Record<string, unknown>).length : 0;

const countNested = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return 0;
  }

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, nested) => total + countRecord(nested),
    0
  );
};

export const EmergencyCommandCenter = {
  async getSnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [
      emergencyQueueSnapshot,
      incidentQueueSnapshot,
      partnerDispatchSnapshot,
      activeBookingsSnapshot,
      internalAlertsSnapshot
    ] = await Promise.all([
      database.ref("operations/emergencyQueue").get(),
      database.ref("operations/incidentQueue").get(),
      database.ref("operations/partnerDispatchQueue").get(),
      database.ref("bookings/byId").get(),
      database.ref("operations/internalAlerts").get()
    ]);

    const bookings = Object.values(
      (activeBookingsSnapshot.val() || {}) as Record<
        string,
        { status?: string; sla?: { status?: string }; matching?: { priority?: string } }
      >
    );
    const criticalBookings = bookings.filter(
      (booking) =>
        booking.matching?.priority === "critical" ||
        booking.sla?.status === "breached" ||
        booking.status === "cancelled"
    ).length;
    const emergencyCount = countNested(emergencyQueueSnapshot.val());
    const incidentCount = countNested(incidentQueueSnapshot.val());
    const partnerDispatchCount = countNested(partnerDispatchSnapshot.val());
    const internalAlerts = Object.values(
      (internalAlertsSnapshot.val() || {}) as Record<string, { status?: string; severity?: string }>
    );
    const openAlerts = internalAlerts.filter((alert) => alert.status !== "resolved").length;
    const commandLevel =
      emergencyCount > 0 || criticalBookings > 0
        ? "red"
        : incidentCount > 0 || openAlerts > 0
          ? "amber"
          : "green";

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        commandLevel,
        emergencyCount,
        incidentCount,
        partnerDispatchCount,
        criticalBookings,
        openAlerts,
        escalationOrder: ["Customer", "Family", "Ops team", "Ambulance", "Hospital"],
        nextAction:
          commandLevel === "red"
            ? "Open emergency queue and assign ops owner now."
            : commandLevel === "amber"
              ? "Review incident and SLA watch queues."
              : "No emergency action needed. Keep monitoring live care."
      }
    };
  }
};
