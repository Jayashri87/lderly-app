import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, jsonError } from "./apiSecurity";

const toBuffer = (value: string) => Buffer.from(value, "utf8");

export const safeEqual = (left = "", right = "") => {
  const leftBuffer = toBuffer(left);
  const rightBuffer = toBuffer(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const requireAuthAttempt = (
  request: NextRequest,
  key: string,
  limit = 8
): NextResponse | null => {
  const rateLimit = checkRateLimit(request, `auth:${key}`, limit);

  return rateLimit.ok ? null : jsonError("Too many sign-in attempts. Try again shortly.", 429);
};

export const verifyConfiguredCredential = ({
  username,
  password,
  expectedUsername,
  expectedPassword
}: {
  username?: string;
  password?: string;
  expectedUsername?: string;
  expectedPassword?: string;
}) => {
  if (!expectedUsername || !expectedPassword) {
    return "unconfigured" as const;
  }

  return safeEqual(username || "", expectedUsername) &&
    safeEqual(password || "", expectedPassword)
    ? ("valid" as const)
    : ("invalid" as const);
};
