import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import { OpsRunbookProvider } from "../../../../server/opsRunbookProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await OpsRunbookProvider.getSnapshot();

  return NextResponse.json({ snapshot: result.snapshot });
}
