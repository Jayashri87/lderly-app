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
  const auth = await requireApiSession(request, ["caretaker"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const body = await parseJsonBody<{ otp?: string }>(request);

  if (!body?.otp || body.otp.trim().length < 4) {
    return jsonError("Customer start OTP is required", 400);
  }

  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.service_start.verify_otp",
    `${bookingId}:${body.otp.trim()}`,
    () =>
      withMutationAudit(
        request,
        {
          action: "booking.service_start.verify_otp",
          resource: bookingId,
          status: "success",
          details: {
            caretakerId: auth.session.uid
          }
        },
        () => TrustedBooking.startWithOtp(bookingId, body.otp || "", auth.session)
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
