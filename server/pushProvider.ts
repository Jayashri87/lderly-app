import { getAdminDatabase } from "./firebaseAdmin";
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
  }
};
