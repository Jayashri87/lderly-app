import { NextRequest, NextResponse } from "next/server";
import { attachRoleSession, createSessionId } from "../../../../server/authSession";
import { registerRoleSession } from "../../../../server/sessionRegistry";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const expectedUsername = process.env.LDERLY_CUSTOMER_USERNAME;
  const expectedPassword = process.env.LDERLY_CUSTOMER_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return NextResponse.json(
      { error: "Customer credentials are not configured" },
      { status: 503 }
    );
  }

  if (body.username !== expectedUsername || body.password !== expectedPassword) {
    return NextResponse.json(
      { error: "Invalid customer credentials" },
      { status: 401 }
    );
  }

  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({ ok: true, role: "customer" }),
    "customer",
    body.username,
    "demo-customer",
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "customer",
    username: body.username,
    uid: "demo-customer",
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
