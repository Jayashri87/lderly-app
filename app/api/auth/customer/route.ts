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

  const limited = requireAuthAttempt(request, "customer", 8);
  if (limited) {
    return limited;
  }

  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const expectedUsername = process.env.LDERLY_CUSTOMER_USERNAME;
  const expectedPassword = process.env.LDERLY_CUSTOMER_PASSWORD;

  const credential = verifyConfiguredCredential({
    username: body.username,
    password: body.password,
    expectedUsername,
    expectedPassword
  });

  if (credential === "unconfigured") {
    return NextResponse.json(
      { error: "Customer credentials are not configured" },
      { status: 503 }
    );
  }

  if (credential !== "valid") {
    return NextResponse.json(
      { error: "Invalid customer credentials" },
      { status: 401 }
    );
  }

  const signedUsername = expectedUsername!;
  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({
      ok: true,
      role: "customer",
      uid: "demo-customer",
      name: "Customer"
    }),
    "customer",
    signedUsername,
    "demo-customer",
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: "customer",
    username: signedUsername,
    uid: "demo-customer",
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
