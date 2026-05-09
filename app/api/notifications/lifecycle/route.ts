import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { OpsReliability } from "../../../../server/opsReliability";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    bookingId?: string;
    title?: string;
    body?: string;
    priority?: "normal" | "urgent" | "critical";
  }>(request);

  if (!body?.userId || !body.bookingId || !body.title || !body.body) {
    return jsonError("User, booking, title, and body are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "notification.lifecycle",
      resource: body.bookingId,
      status: "success",
      details: {
        actor: auth.session.role,
        title: body.title
      }
    },
    () =>
      OpsReliability.broadcastLifecycleUpdate({
        userId: body.userId!,
        bookingId: body.bookingId!,
        title: body.title!,
        body: body.body!,
        priority: body.priority || "normal"
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
