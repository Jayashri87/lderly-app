import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import { OpsAuditProvider } from "../../../../server/opsAuditProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await OpsAuditProvider.getSnapshot();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ snapshot: result.snapshot });
}
