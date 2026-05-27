import { NextRequest, NextResponse } from "next/server";
import { requireAppCheck } from "../../../../server/apiSecurity";
import { attachRoleSession, createSessionId } from "../../../../server/authSession";
import { requireAuthAttempt, verifyConfiguredCredential } from "../../../../server/authGuards";
import { registerRoleSession } from "../../../../server/sessionRegistry";

export async function POST(request: NextRequest) {
  const appCheck = await requireAppCheck(request);
  if (!appCheck.ok) {
    return appCheck.response;
  }

  const limited = requireAuthAttempt(request, "superadmin", 4);
  if (limited) {
    return limited;
  }

  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const expectedUsername = process.env.LDERLY_SUPERADMIN_USERNAME;
  const expectedPassword = process.env.LDERLY_SUPERADMIN_PASSWORD;

  const credential = verifyConfiguredCredential({
    username: body.username,
    password: body.password,
    expectedUsername,
    expectedPassword
  });

  if (credential === "unconfigured") {
    return NextResponse.json(
      { error: "Super admin credentials are not configured" },
      { status: 503 }
    );
  }

  if (credential !== "valid") {
    return NextResponse.json(
      { error: "Invalid super admin credentials" },
      { status: 401 }
    );
  }

  const signedUsername = expectedUsername!;
  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({
      ok: true,
      role: "superadmin",
      uid: "demo-superadmin",
      name: "Super Admin"
    }),
    "superadmin",
    signedUsername,
    "demo-superadmin",
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "superadmin",
    username: signedUsername,
    uid: "demo-superadmin",
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
