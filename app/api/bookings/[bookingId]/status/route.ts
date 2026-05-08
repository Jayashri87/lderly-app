import { NextRequest, NextResponse } from "next/server";
import type { BookingStatus } from "../../../../../services/bookingService";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../../server/trustedBooking";

const validStatuses: BookingStatus[] = [
  "requested",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
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

  const result = await withMutationAudit(
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
    () => TrustedBooking.updateStatus(bookingId, body.status as BookingStatus)
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ booking: result.booking });
}

