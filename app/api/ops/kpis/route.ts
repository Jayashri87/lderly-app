import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import { Observability } from "../../../../server/observability";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await Observability.getOpsKpis();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ kpis: result.kpis });
}
