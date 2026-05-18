import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withBookingMutationLock,
  withIdempotency,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../../server/trustedBooking";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const auth = await requireApiSession(_request, ["admin"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const idempotent = await withIdempotency(
    _request,
    auth.session,
    "booking.assign",
    bookingId,
    () =>
      withBookingMutationLock(
        bookingId,
        `${auth.session.role}:${auth.session.uid || auth.session.username}`,
        () =>
          withMutationAudit(
            _request,
            {
              action: "booking.assign",
              resource: bookingId,
              status: "success",
              details: {
                actor: auth.session.username
              }
            },
            () => TrustedBooking.assign(bookingId)
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
