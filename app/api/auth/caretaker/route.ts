import { NextRequest, NextResponse } from "next/server";
import { attachRoleSession, createSessionId } from "../../../../server/authSession";
import { registerRoleSession } from "../../../../server/sessionRegistry";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const expectedUsername = process.env.LDERLY_CARETAKER_USERNAME;
  const expectedPassword = process.env.LDERLY_CARETAKER_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return NextResponse.json(
      { error: "Caretaker credentials are not configured" },
      { status: 503 }
    );
  }

  if (body.username !== expectedUsername || body.password !== expectedPassword) {
    return NextResponse.json(
      { error: "Invalid caretaker credentials" },
      { status: 401 }
    );
  }

  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({ ok: true, role: "caretaker" }),
    "caretaker",
    body.username,
    "demo-caretaker",
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "caretaker",
    username: body.username,
    uid: "demo-caretaker",
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
