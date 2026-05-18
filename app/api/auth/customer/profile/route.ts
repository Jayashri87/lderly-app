import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { attachRoleSession, createSessionId } from "../../../../../server/authSession";
import { requireAuthAttempt } from "../../../../../server/authGuards";
import { getAdminDatabase } from "../../../../../server/firebaseAdmin";
import { registerRoleSession } from "../../../../../server/sessionRegistry";

const normalizePhone = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
  }

  const digits = trimmed.replace(/[^\d]/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

const customerUidFor = (email: string, phone: string) =>
  `customer-${createHash("sha256")
    .update(`${email.toLowerCase()}|${phone}`)
    .digest("hex")
    .slice(0, 16)}`;

export async function POST(request: NextRequest) {
  const limited = requireAuthAttempt(request, "customer-profile", 12);
  if (limited) {
    return limited;
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
  };
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone || "");

  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!/^\+\d{8,15}$/.test(phone)) {
    return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
  }

  const uid = customerUidFor(email, phone);
  const sessionId = createSessionId();
  const timestamp = Date.now();
  const username = email;
  const adminDb = getAdminDatabase();

  if (adminDb) {
    await adminDb.ref(`users/${uid}`).update({
      uid,
      name,
      email,
      phone,
      role: "customer",
      authMode: "profile",
      roleSource: "customer-profile-form",
      updatedAt: timestamp
    });
  }

  const response = attachRoleSession(
    NextResponse.json({
      ok: true,
      role: "customer",
      uid,
      name,
      email,
      phone
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
