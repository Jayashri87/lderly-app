import type { CareNotification } from "../services/notificationService";
import { deliverNotification } from "./communicationProvider";
import { getAdminDatabase } from "./firebaseAdmin";

type RetryCandidate = CareNotification & {
  id: string;
};

const normalizeNotifications = (value: unknown) =>
  Object.entries((value || {}) as Record<string, CareNotification>).map(([id, notification]) => ({
    ...notification,
    id: notification.id || id
  }));

const retryable = (notification: RetryCandidate, now: number) =>
  notification.channel !== "in_app" &&
  notification.deliveryStatus !== "sent" &&
  (notification.deliveryAttempts || 0) < 3 &&
  (!notification.retryDueAt || notification.retryDueAt <= now);

const compactNotification = (notification: CareNotification) =>
  Object.fromEntries(
    Object.entries(notification).filter(([, value]) => value !== undefined)
  ) as CareNotification;

const notificationIndexUpdates = (notification: CareNotification) => {
  const updates: Record<string, unknown> = {
    [`notifications/byId/${notification.id}`]: notification
  };

  if (notification.userId && notification.userId !== "all") {
    updates[`notifications/byUser/${notification.userId}/${notification.id}`] = notification;
  }

  if (notification.role !== "all") {
    updates[`notifications/byRole/${notification.role}/${notification.id}`] = notification;
  }

  return updates;
};

export const NotificationRetryProvider = {
  async processDue({ limit = 20, now = Date.now() }: { limit?: number; now?: number } = {}) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("notifications/byId").limitToLast(200).get();
    const candidates = normalizeNotifications(snapshot.val())
      .filter((notification) => retryable(notification, now))
      .sort((a, b) => (a.retryDueAt || a.createdAt || 0) - (b.retryDueAt || b.createdAt || 0))
      .slice(0, limit);
    const results = [];
    const updates: Record<string, unknown> = {};

    for (const notification of candidates) {
      const delivery = await deliverNotification({
        notification,
        to: notification.deliveryTarget
      });
      const attempts = (notification.deliveryAttempts || 0) + 1;
      const shouldRetry = ["failed", "queued"].includes(delivery.status) && attempts < 3;
      const nextNotification: CareNotification = compactNotification({
        ...notification,
        deliveryStatus: delivery.status,
        providerReference: delivery.providerReference,
        deliveryAttempts: attempts,
        lastAttemptAt: now,
        retryDueAt: shouldRetry ? now + attempts * 5 * 60 * 1000 : undefined,
        deliveredAt: delivery.status === "sent" ? now : notification.deliveredAt
      });

      Object.assign(updates, notificationIndexUpdates(nextNotification));
      results.push({
        notificationId: notification.id,
        status: delivery.status,
        attempts,
        retryDueAt: nextNotification.retryDueAt || 0
      });
    }

    const runId = `notification-retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    updates[`operations/notificationRetries/${runId}`] = {
      id: runId,
      processed: results.length,
      sent: results.filter((result) => result.status === "sent").length,
      queued: results.filter((result) => result.status === "queued").length,
      failed: results.filter((result) => result.status === "failed").length,
      createdAt: Date.now(),
      results
    };

    await database.ref().update(updates);

    return {
      ok: true as const,
      run: {
        id: runId,
        processed: results.length,
        results
      }
    };
  }
};
