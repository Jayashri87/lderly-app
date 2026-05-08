import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "./authSession";
import { getAdminDatabase } from "./firebaseAdmin";
import { isRoleSessionActive } from "./sessionRegistry";
import type { UserRole } from "../services/authService";

type ApiSession = NonNullable<ReturnType<typeof requireRole>>;

type RateBucket = {
  count: number;
  resetAt: number;
};

type AuditEvent = {
  action: string;
  resource?: string;
  status: "success" | "failure";
  details?: Record<string, unknown>;
};

const buckets = new Map<string, RateBucket>();
const rateWindowMs = 60 * 1000;

const clientIpFor = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

const sameOriginCheck = (request: NextRequest) => {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === request.nextUrl.origin;
};

export const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export const parseJsonBody = async <T>(request: NextRequest): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const requireApiSession = async (
  request: NextRequest,
  roles: UserRole[],
  options: {
    rateLimit?: number;
    csrf?: boolean;
  } = {}
): Promise<
  | {
      ok: true;
      session: ApiSession;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> => {
  const session = requireRole(request, roles);

  if (!session) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  if (!(await isRoleSessionActive(session))) {
    return { ok: false, response: jsonError("Session expired or revoked", 401) };
  }

  if (options.csrf !== false && !sameOriginCheck(request)) {
    return { ok: false, response: jsonError("Invalid request origin", 403) };
  }

  const limit = options.rateLimit ?? 60;
  const key = `${session.uid || session.username}:${request.nextUrl.pathname}:${clientIpFor(
    request
  )}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + rateWindowMs
    });
  } else {
    bucket.count += 1;

    if (bucket.count > limit) {
      return { ok: false, response: jsonError("Too many requests", 429) };
    }
  }

  return { ok: true, session };
};

export const writeAuditLog = async (request: NextRequest, event: AuditEvent) => {
  const database = getAdminDatabase();

  if (!database) {
    return;
  }

  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await database
    .ref(`auditLogs/${id}`)
    .set({
      id,
      ...event,
      path: request.nextUrl.pathname,
      method: request.method,
      ip: clientIpFor(request),
      userAgent: request.headers.get("user-agent") || "",
      createdAt: Date.now()
    })
    .catch(() => undefined);
};

export const withMutationAudit = async <T>(
  request: NextRequest,
  event: AuditEvent,
  handler: () => Promise<T>
) => {
  try {
    const result = await handler();
    await writeAuditLog(request, {
      ...event,
      status: "success"
    });
    return result;
  } catch (error) {
    await writeAuditLog(request, {
      ...event,
      status: "failure",
      details: {
        ...event.details,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });
    throw error;
  }
};
