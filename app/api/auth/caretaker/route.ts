import { NextRequest, NextResponse } from "next/server";
import { requireAppCheck } from "../../../../server/apiSecurity";
import { attachRoleSession, createSessionId } from "../../../../server/authSession";
import { registerRoleSession } from "../../../../server/sessionRegistry";
import {
  requireAuthAttempt,
  verifyConfiguredCredential
} from "../../../../server/authGuards";

export async function POST(request: NextRequest) {
  const appCheck = await requireAppCheck(request);
  if (!appCheck.ok) {
    return appCheck.response;
  }

  const limited = requireAuthAttempt(request, "caretaker", 6);
  if (limited) {
    return limited;
  }

  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const expectedUsername = process.env.LDERLY_CARETAKER_USERNAME;
  const expectedPassword = process.env.LDERLY_CARETAKER_PASSWORD;

  const credential = verifyConfiguredCredential({
    username: body.username,
    password: body.password,
    expectedUsername,
    expectedPassword
  });

  if (credential === "unconfigured") {
    return NextResponse.json(
      { error: "Caretaker credentials are not configured" },
      { status: 503 }
    );
  }

  if (credential !== "valid") {
    return NextResponse.json(
      { error: "Invalid caretaker credentials" },
      { status: 401 }
    );
  }

  const signedUsername = expectedUsername!;
  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({
      ok: true,
      role: "caretaker",
      uid: "demo-caretaker",
      name: "Anita"
    }),
    "caretaker",
    signedUsername,
    "demo-caretaker",
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "caretaker",
    username: signedUsername,
    uid: "demo-caretaker",
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
