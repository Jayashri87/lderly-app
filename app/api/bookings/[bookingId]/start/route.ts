import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
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

  const result = await withMutationAudit(
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
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ booking: result.booking });
}
