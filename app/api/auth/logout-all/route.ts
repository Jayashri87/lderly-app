import { NextRequest, NextResponse } from "next/server";
import { clearRoleSession } from "../../../../server/authSession";
import { revokeAllRoleSessions } from "../../../../server/sessionRegistry";

export async function POST(request: NextRequest) {
  await revokeAllRoleSessions(request);
  return clearRoleSession(NextResponse.json({ ok: true }));
}
