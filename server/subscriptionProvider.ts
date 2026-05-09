import { getAdminDatabase } from "./firebaseAdmin";

export type SubscriptionCadence = "monthly" | "weekly";

export const SubscriptionProvider = {
  async createPlan({
    userId,
    recipientName,
    packageId,
    cadence,
    serviceTypes,
    amountLabel,
    startDate
  }: {
    userId: string;
    recipientName: string;
    packageId: string;
    cadence: SubscriptionCadence;
    serviceTypes: string[];
    amountLabel: string;
    startDate?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `subscription-${userId}-${Date.now()}`;
    const subscription = {
      id,
      userId,
      recipientName,
      packageId,
      cadence,
      serviceTypes,
      amountLabel,
      status: "active",
      startDate: startDate || new Date().toISOString().slice(0, 10),
      nextBillingAt:
        cadence === "monthly"
          ? Date.now() + 30 * 24 * 60 * 60 * 1000
          : Date.now() + 7 * 24 * 60 * 60 * 1000,
      nextVisitWindow:
        cadence === "monthly" ? "Next month" : "Next week",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`subscriptions/byId/${id}`]: subscription,
      [`subscriptions/byUser/${userId}/${id}`]: true,
      [`profiles/${userId}/activeSubscriptions/${id}`]: true,
      [`operations/subscriptionQueue/active/${id}`]: true
    });

    return { ok: true as const, subscription };
  }
};
