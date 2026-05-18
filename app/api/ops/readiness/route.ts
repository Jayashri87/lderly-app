import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import { ProductionReadinessProvider } from "../../../../server/productionReadinessProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await ProductionReadinessProvider.getSnapshot();

  return NextResponse.json({ snapshot: result.snapshot });
}
