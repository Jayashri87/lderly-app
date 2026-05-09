import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { MonthlyReportProvider } from "../../../../server/monthlyReportProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "customer"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    month?: string;
  }>(request);
  const userId =
    auth.session.role === "customer"
      ? auth.session.uid
      : body?.userId || auth.session.uid;

  if (!userId) {
    return jsonError("User id is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "reports.monthly.generate",
      resource: userId,
      status: "success",
      details: {
        actor: auth.session.role,
        month: body?.month || "current"
      }
    },
    () =>
      MonthlyReportProvider.generate({
        userId,
        month: body?.month
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, monthlyReport: result.monthlyReport });
}
