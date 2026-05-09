import { getAdminDatabase, getAdminMessaging } from "./firebaseAdmin";
import type { UserRole } from "../services/authService";

export type PushPlatform = "android" | "ios" | "web";

export const PushProvider = {
  async registerToken({
    userId,
    role,
    token,
    platform,
    deviceId
  }: {
    userId: string;
    role: UserRole;
    token: string;
    platform: PushPlatform;
    deviceId?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = deviceId || `device-${Math.random().toString(36).slice(2, 10)}`;
    const record = {
      id,
      userId,
      role,
      token,
      platform,
      enabled: true,
      lastSeenAt: Date.now(),
      createdAt: Date.now()
    };

    await database.ref().update({
      [`pushTokens/byUser/${userId}/${id}`]: record,
      [`pushTokens/byRole/${role}/${userId}-${id}`]: true,
      [`pushTokens/byToken/${token.replace(/[.#$/[\]]/g, "_")}`]: {
        userId,
        role,
        deviceId: id,
        platform,
        updatedAt: Date.now()
      }
    });

    return {
      ok: true as const,
      token: record
    };
  },

  async dispatchToUser({
    userId,
    title,
    body,
    data = {}
  }: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const tokensSnapshot = await database.ref(`pushTokens/byUser/${userId}`).get();
    const records = Object.values(
      (tokensSnapshot.val() || {}) as Record<
        string,
        {
          id: string;
          token: string;
          platform: PushPlatform;
          enabled?: boolean;
        }
      >
    ).filter((record) => record.enabled !== false && record.token);
    const dispatchId = `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (!records.length) {
      await database.ref(`pushDispatches/byId/${dispatchId}`).set({
        id: dispatchId,
        userId,
        title,
        body,
        status: "no_tokens",
        sent: 0,
        failed: 0,
        createdAt: Date.now()
      });
      return {
        ok: true as const,
        dispatch: {
          id: dispatchId,
          status: "no_tokens",
          sent: 0,
          failed: 0
        }
      };
    }

    const messaging = getAdminMessaging();
    let sent = 0;
    let failed = 0;
    const failures: Array<{ token: string; error: string }> = [];

    if (messaging) {
      const result = await messaging.sendEachForMulticast({
        tokens: records.map((record) => record.token),
        notification: {
          title,
          body
        },
        data: {
          source: "lderly",
          ...data
        },
        webpush: {
          fcmOptions: {
            link: data.link || "/"
          }
        }
      });

      sent = result.successCount;
      failed = result.failureCount;
      result.responses.forEach((response, index) => {
        if (!response.success) {
          failures.push({
            token: records[index]?.token || "unknown",
            error: response.error?.message || "Unknown FCM error"
          });
        }
      });
    }

    const status = messaging ? (failed ? "partial" : "sent") : "queued";
    const dispatch = {
      id: dispatchId,
      userId,
      title,
      body,
      status,
      mode: messaging ? "fcm" : "queued",
      attempted: records.length,
      sent,
      failed,
      failures,
      createdAt: Date.now()
    };

    await database.ref().update({
      [`pushDispatches/byId/${dispatchId}`]: dispatch,
      [`pushDispatches/byUser/${userId}/${dispatchId}`]: true
    });

    return {
      ok: true as const,
      dispatch
    };
  }
};
