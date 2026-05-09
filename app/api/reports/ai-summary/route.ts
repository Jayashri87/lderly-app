import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { ReportIntelligence } from "../../../../server/reportIntelligence";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], {
    rateLimit: 80
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ reportId?: string }>(request);

  if (!body || !isNonEmptyString(body.reportId)) {
    return jsonError("Report id is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "reports.ai_summary.generate",
      resource: body.reportId,
      status: "success",
      details: {
        actor: auth.session.role
      }
    },
    () => ReportIntelligence.generateSummary(body.reportId!)
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, summary: result.summary });
}
