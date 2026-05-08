import { NextRequest, NextResponse } from "next/server";
import { attachRoleSession, createSessionId } from "../../../../server/authSession";
import { registerRoleSession } from "../../../../server/sessionRegistry";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const expectedUsername = process.env.LDERLY_ADMIN_USERNAME;
  const expectedPassword = process.env.LDERLY_ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return NextResponse.json(
      { error: "Admin credentials are not configured" },
      { status: 503 }
    );
  }

  if (body.username !== expectedUsername || body.password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const sessionId = createSessionId();
  const response = attachRoleSession(
    NextResponse.json({ ok: true, role: "admin" }),
    "admin",
    body.username,
    "demo-admin",
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "admin",
    username: body.username,
    uid: "demo-admin",
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12
  });

  return response;
}
