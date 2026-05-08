import { NextRequest } from "next/server";
import type { SessionPayload } from "./authSession";
import { getRoleSession } from "./authSession";
import { getAdminDatabase } from "./firebaseAdmin";

export type DeviceSessionRecord = {
  sessionId: string;
  uid: string;
  username: string;
  role: string;
  status: "active" | "revoked";
  userAgent: string;
  ip: string;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
};

const clientIpFor = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

const uidFor = (session: SessionPayload) => session.uid || session.username;

export const registerRoleSession = async (
  request: NextRequest,
  session: SessionPayload
) => {
  const database = getAdminDatabase();

  if (!database) {
    return;
  }

  const uid = uidFor(session);
  const record: DeviceSessionRecord = {
    sessionId: session.sessionId,
    uid,
    username: session.username,
    role: session.role,
    status: "active",
    userAgent: request.headers.get("user-agent") || "",
    ip: clientIpFor(request),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };

  await database.ref(`deviceSessions/byId/${session.sessionId}`).set(record);
  await database
    .ref(`deviceSessions/byUser/${uid}/${session.sessionId}`)
    .set({
      status: record.status,
      role: record.role,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    });
};

export const isRoleSessionActive = async (session: SessionPayload) => {
  const database = getAdminDatabase();

  if (!database) {
    return true;
  }

  const snapshot = await database
    .ref(`deviceSessions/byId/${session.sessionId}`)
    .get();
  const record = snapshot.val() as DeviceSessionRecord | null;

  return Boolean(record && record.status === "active" && record.expiresAt > Date.now());
};

export const revokeRoleSession = async (session: SessionPayload | null) => {
  if (!session) {
    return;
  }

  const database = getAdminDatabase();

  if (!database) {
    return;
  }

  const uid = uidFor(session);
  const revokedAt = Date.now();

  await database.ref().update({
    [`deviceSessions/byId/${session.sessionId}/status`]: "revoked",
    [`deviceSessions/byId/${session.sessionId}/revokedAt`]: revokedAt,
    [`deviceSessions/byUser/${uid}/${session.sessionId}/status`]: "revoked",
    [`deviceSessions/byUser/${uid}/${session.sessionId}/revokedAt`]: revokedAt
  });
};

export const revokeAllRoleSessions = async (request: NextRequest) => {
  const session = getRoleSession(request);
  const database = getAdminDatabase();

  if (!session || !database) {
    return session;
  }

  const uid = uidFor(session);
  const snapshot = await database.ref(`deviceSessions/byUser/${uid}`).get();
  const records = (snapshot.val() || {}) as Record<string, { status?: string }>;
  const revokedAt = Date.now();
  const updates: Record<string, unknown> = {};

  for (const sessionId of Object.keys(records)) {
    updates[`deviceSessions/byId/${sessionId}/status`] = "revoked";
    updates[`deviceSessions/byId/${sessionId}/revokedAt`] = revokedAt;
    updates[`deviceSessions/byUser/${uid}/${sessionId}/status`] = "revoked";
    updates[`deviceSessions/byUser/${uid}/${sessionId}/revokedAt`] = revokedAt;
  }

  await database.ref().update(updates);
  return session;
};
