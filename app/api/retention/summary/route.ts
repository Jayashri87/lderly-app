import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { RetentionProvider } from "../../../../server/retentionProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "customer"], { rateLimit: 50 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    recipientName?: string;
  }>(request);
  const userId =
    auth.session.role === "customer"
      ? auth.session.uid
      : body?.userId || auth.session.uid;

  if (!isNonEmptyString(userId)) {
    return jsonError("Valid userId is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "retention.summary.generate",
      resource: userId,
      status: "success",
      details: {
        actor: auth.session.role,
        recipientName: body?.recipientName || ""
      }
    },
    () =>
      RetentionProvider.summary({
        userId,
        recipientName: body?.recipientName
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, summary: result.summary });
}
