import { NextRequest, NextResponse } from "next/server";
import {
  parseJsonBody,
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
  const body = await parseJsonBody<{ reason?: string }>(request);
  const reason = body?.reason?.trim() || "Caregiver unavailable";
  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.dispatch.reject",
    `${bookingId}:${reason}`,
    () =>
      withBookingMutationLock(
        bookingId,
        `${auth.session.role}:${auth.session.uid || auth.session.username}`,
        () =>
          withMutationAudit(
            request,
            {
              action: "booking.dispatch.reject",
              resource: bookingId,
              status: "success",
              details: {
                caretakerId: auth.session.uid,
                reason
              }
            },
            () => TrustedBooking.rejectOffer(bookingId, auth.session, reason)
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
