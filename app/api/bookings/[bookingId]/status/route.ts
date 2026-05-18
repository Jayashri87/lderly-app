import { NextRequest, NextResponse } from "next/server";
import type { BookingStatus } from "../../../../../services/bookingService";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withBookingMutationLock,
  withIdempotency,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../../server/trustedBooking";

const validStatuses: BookingStatus[] = [
  "requested",
  "searching",
  "assigned",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
  "completed",
  "payment_settled",
  "report_generated",
  "cancelled"
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const auth = await requireApiSession(request, ["caretaker", "admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const body = await parseJsonBody<{ status?: BookingStatus }>(request);

  if (!body?.status || !validStatuses.includes(body.status)) {
    return jsonError("Valid booking status is required", 400);
  }

  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.status",
    `${bookingId}:${body.status}`,
    () =>
      withBookingMutationLock(
        bookingId,
        `${auth.session.role}:${auth.session.uid || auth.session.username}`,
        () =>
          withMutationAudit(
            request,
            {
              action: "booking.status",
              resource: bookingId,
              status: "success",
              details: {
                actor: auth.session.role,
                nextStatus: body.status
              }
            },
            () => TrustedBooking.updateStatus(bookingId, body.status as BookingStatus, auth.session)
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
