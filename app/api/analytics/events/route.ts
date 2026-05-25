import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { Observability } from "../../../../server/observability";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "caretaker", "admin"], {
    rateLimit: 180
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    name?: string;
    bookingId?: string;
    properties?: Record<string, unknown>;
  }>(request);

  if (!body?.name || body.name.length > 120) {
    return jsonError("Valid event name is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "analytics.event.capture",
      resource: body.name,
      status: "success",
      details: {
        actor: auth.session.role,
        bookingId: body.bookingId || ""
      }
    },
    () =>
      Observability.captureEvent({
        name: body.name!,
        userId: auth.session.uid || auth.session.username,
        role: auth.session.role,
        bookingId: body.bookingId || undefined,
        properties: body.properties || {}
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ event: result.event });
}
