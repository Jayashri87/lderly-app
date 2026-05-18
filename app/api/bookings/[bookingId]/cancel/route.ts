import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withIdempotency,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../../server/trustedBooking";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const auth = await requireApiSession(request, ["customer", "caretaker", "admin"], {
    rateLimit: 40
  });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const body = await parseJsonBody<{ reason?: string }>(request);

  if (!body?.reason || body.reason.trim().length < 3) {
    return jsonError("Cancellation reason is required", 400);
  }

  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.cancel",
    `${bookingId}:${body.reason.trim()}`,
    () =>
      withMutationAudit(
        request,
        {
          action: "booking.cancel",
          resource: bookingId,
          status: "success",
          details: {
            actor: auth.session.role,
            reason: body.reason
          }
        },
        () =>
          TrustedBooking.cancel(
            bookingId,
            {
              cancelledBy: auth.session.role,
              reason: body.reason!.trim()
            },
            auth.session
          )
      )
  );
  const result = idempotent.value;

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { booking: result.booking, replayed: idempotent.replayed },
    { headers: idempotent.replayed ? { "x-idempotent-replay": "true" } : undefined }
  );
}
