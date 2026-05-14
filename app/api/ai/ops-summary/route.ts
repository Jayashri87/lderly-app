import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, withMutationAudit } from "../../../../server/apiSecurity";
import { AiIntelligenceProvider } from "../../../../server/aiIntelligenceProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ai.ops_summary.generate",
      resource: "ops",
      status: "success",
      details: {
        actor: auth.session.username
      }
    },
    () => AiIntelligenceProvider.opsSummary()
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, summary: result.summary });
}
