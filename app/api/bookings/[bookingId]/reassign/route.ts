import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withIdempotency,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../../server/trustedBooking";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.reassign",
    "",
    () =>
      withMutationAudit(
        request,
        {
          action: "booking.reassign",
          resource: bookingId,
          status: "success",
          details: {
            actor: auth.session.username
          }
        },
        () => TrustedBooking.reassign(bookingId)
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
