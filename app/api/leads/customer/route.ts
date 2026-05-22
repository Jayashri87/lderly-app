import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuthAttempt } from "../../../../server/authGuards";
import { getAdminDatabase } from "../../../../server/firebaseAdmin";

const normalizePhone = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
  }

  const digits = trimmed.replace(/[^\d]/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

const stableLeadIdFor = (email: string, phone: string) =>
  `lead-${createHash("sha256")
    .update(`${email.toLowerCase()}|${phone}`)
    .digest("hex")
    .slice(0, 18)}`;

export async function POST(request: NextRequest) {
  const limited = requireAuthAttempt(request, "customer-lead", 12);
  if (limited) {
    return limited;
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    careFor?: string;
    careNeed?: string;
    preferredContact?: string;
    source?: string;
  };
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone || "");
  const timestamp = Date.now();

  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!/^\+\d{8,15}$/.test(phone)) {
    return NextResponse.json({ error: "Valid contact number is required" }, { status: 400 });
  }

  const adminDb = getAdminDatabase();
  const leadId = stableLeadIdFor(email, phone);

  if (adminDb) {
    const leadRef = adminDb.ref(`customerLeads/${leadId}`);
    const existing = await leadRef.get();
    const previous = existing.val() as { createdAt?: number; touchCount?: number } | null;

    await leadRef.update({
      id: leadId,
      name,
      email,
      phone,
      careFor: (body.careFor || "Not specified").trim().slice(0, 80),
      careNeed: (body.careNeed || "Need help deciding").trim().slice(0, 140),
      preferredContact: (body.preferredContact || "Phone call").trim().slice(0, 40),
      source: body.source || "web",
      status: previous?.createdAt ? "follow_up_requested" : "new",
      touchCount: (previous?.touchCount || 0) + 1,
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp
    });
  }

  return NextResponse.json({
    ok: true,
    leadId: adminDb ? leadId : `local-${randomUUID()}`,
    status: "received"
  });
}
