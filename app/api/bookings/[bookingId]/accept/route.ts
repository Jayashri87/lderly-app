import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, withMutationAudit } from "../../../../../server/apiSecurity";
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
  const result = await withMutationAudit(
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
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ booking: result.booking });
}
