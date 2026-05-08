import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "../services/authService";

const cookieName = "lderly_session";

export type SessionPayload = {
  sessionId: string;
  role: UserRole;
  username: string;
  uid?: string;
  createdAt: number;
  expiresAt: number;
};

const getSecret = () => process.env.LDERLY_AUTH_SECRET || "";

const encodeBase64Url = (value: string) =>
  Buffer.from(value).toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  createHmac("sha256", getSecret()).update(payload).digest("base64url");

const createToken = (payload: SessionPayload) => {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const createSessionId = () =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const verifyToken = (token: string): SessionPayload | null => {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !getSecret()) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;

    if (!payload.expiresAt || payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const attachRoleSession = (
  response: NextResponse,
  role: UserRole,
  username: string,
  uid?: string,
  sessionId = createSessionId()
) => {
  const timestamp = Date.now();
  const token = createToken({
    sessionId,
    role,
    username,
    uid,
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
};

export const getRoleSession = (request: NextRequest) => {
  const token = request.cookies.get(cookieName)?.value;
  return token ? verifyToken(token) : null;
};

export const requireRole = (request: NextRequest, roles: UserRole[]) => {
  const session = getRoleSession(request);

  if (!session || !roles.includes(session.role)) {
    return null;
  }

  return session;
};

export const clearRoleSession = (response: NextResponse) => {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
};
