import { NextRequest, NextResponse } from "next/server";

const protectedRoutes: Record<string, "admin" | "caretaker"> = {};

type ProxySession = {
  role?: string;
  expiresAt?: number;
};

const encode = (value: string) => new TextEncoder().encode(value);

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
};

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

const sign = async (payload: string) => {
  const secret = process.env.LDERLY_AUTH_SECRET || "";

  if (!secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encode(payload));
  const bytes = Array.from(new Uint8Array(signature));
  const binary = String.fromCharCode(...bytes);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const readVerifiedSession = async (token?: string): Promise<ProxySession | null> => {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload);

  if (!expectedSignature || !timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as ProxySession;

    if (!payload.expiresAt || payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const requiredRoleFor = (pathname: string) =>
  Object.entries(protectedRoutes).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`)
  )?.[1];

const applySecurityHeaders = (response: NextResponse) => {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("X-LDERLY-Cache-Policy", "runtime-routes-no-store");

  return response;
};

const redirectToSignin = (request: NextRequest, reason: string) => {
  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("next", request.nextUrl.pathname);
  url.searchParams.set("reason", reason);
  return applySecurityHeaders(NextResponse.redirect(url));
};

const withRequestTelemetry = (response: NextResponse, requestId: string, startedAt: number) => {
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Process-Time", `${Date.now() - startedAt}ms`);
  return response;
};

export async function proxy(request: NextRequest) {
  const startedAt = Date.now();
  const pathname = request.nextUrl.pathname;
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (pathname.includes("../") || pathname.includes("..\\")) {
    return withRequestTelemetry(
      applySecurityHeaders(NextResponse.json({ error: "Invalid request" }, { status: 400 })),
      requestId,
      startedAt
    );
  }

  const requiredRole = requiredRoleFor(pathname);

  if (requiredRole) {
    const session = await readVerifiedSession(request.cookies.get("lderly_session")?.value);

    if (!session) {
      return withRequestTelemetry(
        redirectToSignin(request, "session_required"),
        requestId,
        startedAt
      );
    }

    if (
      session.role !== requiredRole &&
      !(requiredRole === "admin" && session.role === "superadmin")
    ) {
      return withRequestTelemetry(redirectToSignin(request, "role_required"), requestId, startedAt);
    }
  }

  return withRequestTelemetry(
    applySecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders
        }
      })
    ),
    requestId,
    startedAt
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
