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
  lastActivityAt?: number;
};

const clientIpFor = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

const uidFor = (session: SessionPayload) => session.uid || session.username;

const sessionCache = new Map<
  string,
  {
    record: DeviceSessionRecord | null;
    cachedAt: number;
  }
>();
const sessionCacheTtlMs = 15 * 1000;
const activityWriteIntervalMs = 5 * 60 * 1000;

const cachedSessionFor = (sessionId: string) => {
  const cached = sessionCache.get(sessionId);

  if (!cached || Date.now() - cached.cachedAt > sessionCacheTtlMs) {
    return undefined;
  }

  return cached.record;
};

const setCachedSession = (sessionId: string, record: DeviceSessionRecord | null) => {
  sessionCache.set(sessionId, {
    record,
    cachedAt: Date.now()
  });
};

export const registerRoleSession = async (request: NextRequest, session: SessionPayload) => {
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
    expiresAt: session.expiresAt,
    lastActivityAt: Date.now()
  };

  await Promise.all([
    database.ref(`deviceSessions/byId/${session.sessionId}`).set(record),
    database.ref(`deviceSessions/byUser/${uid}/${session.sessionId}`).set({
      status: record.status,
      role: record.role,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    })
  ]);

  setCachedSession(session.sessionId, record);
};

export const isRoleSessionActive = async (session: SessionPayload) => {
  const database = getAdminDatabase();

  if (!database) {
    return true;
  }

  const cached = cachedSessionFor(session.sessionId);

  if (cached !== undefined) {
    return Boolean(cached && cached.status === "active" && cached.expiresAt > Date.now());
  }

  const snapshot = await database.ref(`deviceSessions/byId/${session.sessionId}`).get();
  const record = snapshot.val() as DeviceSessionRecord | null;

  setCachedSession(session.sessionId, record);

  return Boolean(record && record.status === "active" && record.expiresAt > Date.now());
};

export const updateSessionActivity = async (session: SessionPayload) => {
  const database = getAdminDatabase();

  if (!database) {
    return;
  }

  const cached = cachedSessionFor(session.sessionId);
  const lastActivityAt = cached?.lastActivityAt || session.createdAt;
  const now = Date.now();

  if (now - lastActivityAt < activityWriteIntervalMs) {
    return;
  }

  await database
    .ref(`deviceSessions/byId/${session.sessionId}/lastActivityAt`)
    .set(now)
    .catch(() => undefined);

  if (cached) {
    setCachedSession(session.sessionId, {
      ...cached,
      lastActivityAt: now
    });
  } else {
    sessionCache.delete(session.sessionId);
  }
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

  sessionCache.delete(session.sessionId);
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
    sessionCache.delete(sessionId);
  }

  await database.ref().update(updates);
  return session;
};

export const cleanupExpiredSessions = async (): Promise<number> => {
  const database = getAdminDatabase();

  if (!database) {
    return 0;
  }

  const snapshot = await database.ref("deviceSessions/byId").get();
  const sessions = (snapshot.val() || {}) as Record<string, DeviceSessionRecord>;
  const now = Date.now();
  const updates: Record<string, null> = {};

  for (const [sessionId, record] of Object.entries(sessions)) {
    if (record.expiresAt < now) {
      updates[`deviceSessions/byId/${sessionId}`] = null;
      updates[`deviceSessions/byUser/${record.uid}/${sessionId}`] = null;
      sessionCache.delete(sessionId);
    }
  }

  if (Object.keys(updates).length > 0) {
    await database.ref().update(updates);
  }

  return Object.keys(updates).length / 2;
};
