import { NextRequest, NextResponse } from "next/server";
import { clearRoleSession, getRoleSession } from "../../../../server/authSession";
import { revokeRoleSession } from "../../../../server/sessionRegistry";

export async function POST(request: NextRequest) {
  await revokeRoleSession(getRoleSession(request));
  return clearRoleSession(NextResponse.json({ ok: true }));
}
