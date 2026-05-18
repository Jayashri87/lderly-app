import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withBookingMutationLock,
  withIdempotency,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../../server/trustedBooking";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const auth = await requireApiSession(request, ["caretaker"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.dispatch.accept",
    bookingId,
    () =>
      withBookingMutationLock(
        bookingId,
        `${auth.session.role}:${auth.session.uid || auth.session.username}`,
        () =>
          withMutationAudit(
            request,
            {
              action: "booking.dispatch.accept",
              resource: bookingId,
              status: "success",
              details: {
                caretakerId: auth.session.uid
              }
            },
            () => TrustedBooking.acceptOffer(bookingId, auth.session)
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
