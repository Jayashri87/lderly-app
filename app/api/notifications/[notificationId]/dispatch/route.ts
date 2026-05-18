import { NextRequest, NextResponse } from "next/server";
import {
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { deliverNotification } from "../../../../../server/communicationProvider";
import { getAdminDatabase } from "../../../../../server/firebaseAdmin";
import type { CareNotification } from "../../../../../services/notificationService";

const compactNotification = (notification: CareNotification) =>
  Object.fromEntries(
    Object.entries(notification).filter(([, value]) => value !== undefined)
  ) as CareNotification;

const notificationUpdates = (
  notification: CareNotification,
  nextStatus: CareNotification["deliveryStatus"],
  providerReference: string,
  to = ""
) => {
  const attempts = (notification.deliveryAttempts || 0) + 1;
  const shouldRetry = nextStatus === "failed" || nextStatus === "queued";
  const nextNotification = compactNotification({
    ...notification,
    deliveryStatus: nextStatus,
    deliveryTarget: to || notification.deliveryTarget || "",
    providerReference,
    deliveryAttempts: attempts,
    lastAttemptAt: Date.now(),
    retryDueAt: shouldRetry && attempts < 3 ? Date.now() + attempts * 5 * 60 * 1000 : undefined,
    deliveredAt: nextStatus === "sent" ? Date.now() : notification.deliveredAt
  });
  const updates: Record<string, unknown> = {
    [`notifications/byId/${notification.id}`]: nextNotification
  };

  if (notification.userId && notification.userId !== "all") {
    updates[`notifications/byUser/${notification.userId}/${notification.id}`] =
      nextNotification;
  }

  if (notification.role !== "all") {
    updates[`notifications/byRole/${notification.role}/${notification.id}`] =
      nextNotification;
  }

  if (notification.role === "all") {
    updates[`notifications/byRole/customer/${notification.id}`] = nextNotification;
    updates[`notifications/byRole/caretaker/${notification.id}`] = nextNotification;
    updates[`notifications/byRole/admin/${notification.id}`] = nextNotification;
  }

  return updates;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const database = getAdminDatabase();

  if (!database) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured" },
      { status: 503 }
    );
  }

  const { notificationId } = await context.params;
  const body = (await parseJsonBody<{ to?: string }>(request)) || {};
  const snapshot = await database.ref(`notifications/byId/${notificationId}`).get();
  const notification = snapshot.val() as CareNotification | null;

  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const delivery = await deliverNotification({
    notification,
    to: body.to
  });

  await withMutationAudit(
    request,
    {
      action: "notification.dispatch",
      resource: notificationId,
      status: "success",
      details: {
        actor: auth.session.role,
        channel: notification.channel,
        deliveryStatus: delivery.status
      }
    },
    () =>
      database
        .ref()
        .update(
          notificationUpdates(
            notification,
            delivery.status,
            delivery.providerReference,
            body.to
          )
        )
  );

  return NextResponse.json({
    ok: true,
    notificationId,
    delivery
  });
}

