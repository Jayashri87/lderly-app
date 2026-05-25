import { NextRequest, NextResponse } from "next/server";
import { verifyAppCheckToken } from "./appCheckProvider";
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

type IdempotencySession = {
  uid?: string;
  username?: string;
  role?: string;
};

const buckets = new Map<string, RateBucket>();
const rateWindowMs = 60 * 1000;

const clientIpFor = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "local";

const isLikelyBrowserRequest = (request: NextRequest) => {
  const userAgent = request.headers.get("user-agent") || "";
  const accept = request.headers.get("accept") || "";

  return /mozilla|chrome|safari|firefox|edg/i.test(userAgent) || accept.includes("text/html");
};

const sameOriginCheck = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    return origin === request.nextUrl.origin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }

  return !isLikelyBrowserRequest(request);
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

const safeFirebaseKey = (value: string) =>
  value.replace(/[.#$/[\]]/g, "_").slice(0, 420);

const isFailedOperationResult = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "ok" in value &&
      (value as { ok?: unknown }).ok === false
  );

export const checkRateLimit = (
  request: NextRequest,
  key: string,
  limit = 60,
  windowMs = rateWindowMs
) => {
  const bucketKey = `${key}:${clientIpFor(request)}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + windowMs
    });
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
  }

  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt
  };
};

export const requireAppCheck = async (request: NextRequest) => {
  const result = await verifyAppCheckToken(request.headers.get("x-firebase-appcheck"));

  if (!result.ok) {
    return {
      ok: false as const,
      response: jsonError(result.error, result.status)
    };
  }

  return {
    ok: true as const,
    appId: result.appId,
    enforced: result.enforced
  };
};

export const requireApiSession = async (
  request: NextRequest,
  roles: UserRole[],
  options: {
    rateLimit?: number;
    csrf?: boolean;
    appCheck?: boolean;
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

  if (options.appCheck !== false) {
    const appCheck = await requireAppCheck(request);

    if (!appCheck.ok) {
      return { ok: false, response: appCheck.response };
    }
  }

  const rateLimit = checkRateLimit(
    request,
    `api:${session.uid || session.username}:${request.nextUrl.pathname}`,
    options.rateLimit ?? 60
  );

  if (!rateLimit.ok) {
    return { ok: false, response: jsonError("Too many requests", 429) };
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

export const withIdempotency = async <T>(
  request: NextRequest,
  session: IdempotencySession,
  operation: string,
  fallbackKey: string,
  handler: () => Promise<T>
): Promise<{ value: T; replayed: boolean }> => {
  const database = getAdminDatabase();
  const headerKey = request.headers.get("idempotency-key")?.trim();
  const rawKey = headerKey || fallbackKey;

  if (!database || !rawKey) {
    return { value: await handler(), replayed: false };
  }

  const owner = session.uid || session.username || "anonymous";
  const key = safeFirebaseKey(`${operation}:${session.role || "role"}:${owner}:${rawKey}`);
  const ref = database.ref(`operations/idempotency/${key}`);
  const existingSnapshot = await ref.get();
  const existing = existingSnapshot.val() as
    | {
        value?: T;
        operation?: string;
        path?: string;
      }
    | null;

  if (existing?.value && existing.operation === operation && existing.path === request.nextUrl.pathname) {
    return { value: existing.value, replayed: true };
  }

  const value = await handler();

  if (isFailedOperationResult(value)) {
    return { value, replayed: false };
  }

  await ref
    .set({
      operation,
      path: request.nextUrl.pathname,
      method: request.method,
      owner,
      role: session.role || "",
      idempotencyKey: rawKey.slice(0, 180),
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    })
    .catch(() => undefined);

  return { value, replayed: false };
};

export const withBookingMutationLock = async <T>(
  bookingId: string,
  owner: string,
  handler: () => Promise<T>
): Promise<T | { ok: false; status: 409; error: string }> => {
  const database = getAdminDatabase();

  if (!database) {
    return handler();
  }

  const now = Date.now();
  const lockOwner = `${owner}:${Math.random().toString(36).slice(2, 8)}`;
  const lockRef = database.ref(`operations/locks/bookings/${safeFirebaseKey(bookingId)}`);
  const transaction = await lockRef.transaction((current) => {
    if (current?.expiresAt && current.expiresAt > now && current.owner !== lockOwner) {
      return undefined;
    }

    return {
      owner: lockOwner,
      acquiredAt: now,
      expiresAt: now + 15_000
    };
  });

  if (!transaction.committed) {
    return {
      ok: false,
      status: 409,
      error: "Booking action already in progress. Please refresh in a moment."
    };
  }

  try {
    return await handler();
  } finally {
    const snapshot = await lockRef.get().catch(() => null);
    if (snapshot?.val()?.owner === lockOwner) {
      await lockRef.remove().catch(() => undefined);
    }
  }
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
