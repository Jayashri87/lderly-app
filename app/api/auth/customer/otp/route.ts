import { NextRequest, NextResponse } from "next/server";
import { attachRoleSession, createSessionId } from "../../../../../server/authSession";
import { registerRoleSession } from "../../../../../server/sessionRegistry";
import { requireAuthAttempt } from "../../../../../server/authGuards";

const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");

export async function POST(request: NextRequest) {
  const limited = requireAuthAttempt(request, "customer-otp", 8);
  if (limited) {
    return limited;
  }

  const body = (await request.json()) as {
    phone?: string;
    otp?: string;
  };
  const phone = normalizePhone(body.phone || "");
  const otp = (body.otp || "").trim();

  if (phone.length < 8) {
    return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
  }

  if (otp.length < 4) {
    return NextResponse.json({ error: "Valid OTP is required" }, { status: 400 });
  }

  const uid = `customer-${phone.slice(-10)}`;
  const username = `phone-${phone.slice(-10)}`;
  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({
      ok: true,
      role: "customer",
      uid,
      name: "Customer"
    }),
    "customer",
    username,
    uid,
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "customer",
    username,
    uid,
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
