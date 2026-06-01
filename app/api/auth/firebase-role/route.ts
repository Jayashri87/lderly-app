import { NextRequest, NextResponse } from "next/server";
import { requireAppCheck } from "../../../../server/apiSecurity";
import { attachRoleSession, createSessionId, getRoleSession } from "../../../../server/authSession";
import {
  getAdminAuth,
  getAdminDatabase,
  hasFirebaseAdminConfig
} from "../../../../server/firebaseAdmin";
import { isUserRole } from "@lderly/shared-types";
import type { UserRole } from "../../../../services/authService";
import { registerRoleSession } from "../../../../server/sessionRegistry";

const canAssignRole = (request: NextRequest, role: UserRole) => {
  if (role === "customer") {
    return true;
  }

  const session = getRoleSession(request);
  return Boolean(session && (session.role === role || session.role === "superadmin"));
};

export async function POST(request: NextRequest) {
  const appCheck = await requireAppCheck(request);
  if (!appCheck.ok) {
    return appCheck.response;
  }

  const body = (await request.json()) as {
    idToken?: string;
    role?: unknown;
    name?: string;
  };

  if (!isUserRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (!body.idToken) {
    return NextResponse.json({ error: "Firebase ID token is required" }, { status: 400 });
  }

  if (!canAssignRole(request, body.role)) {
    return NextResponse.json({ error: "Role assignment is not allowed" }, { status: 403 });
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDatabase();

  if (!hasFirebaseAdminConfig || !adminAuth || !adminDb) {
    return NextResponse.json(
      {
        ok: false,
        mode: "client-fallback",
        reason: "Firebase Admin credentials are not configured"
      },
      { status: 202 }
    );
  }

  const decoded = await adminAuth.verifyIdToken(body.idToken);
  const now = Date.now();
  const name = body.name || decoded.name || decoded.phone_number || body.role;

  await Promise.all([
    adminAuth.setCustomUserClaims(decoded.uid, { role: body.role }),
    adminDb.ref(`users/${decoded.uid}`).update({
      uid: decoded.uid,
      name,
      role: body.role,
      authMode: "firebase",
      roleSource: "server",
      email: decoded.email || null,
      phoneNumber: decoded.phone_number || null,
      updatedAt: now
    })
  ]);

  const sessionId = createSessionId();
  const timestamp = Date.now();
  const response = attachRoleSession(
    NextResponse.json({
      ok: true,
      mode: "trusted-role-sync",
      uid: decoded.uid,
      role: body.role
    }),
    body.role,
    name,
    decoded.uid,
    sessionId
  );

  await registerRoleSession(request, {
    sessionId,
    role: body.role,
    username: name,
    uid: decoded.uid,
    createdAt: timestamp,
    expiresAt: timestamp + 1000 * 60 * 60 * 12
  });

  return response;
}
