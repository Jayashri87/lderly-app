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
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const body = await parseJsonBody<{ score?: number; note?: string }>(request);

  if (!body?.score || body.score < 1 || body.score > 5) {
    return jsonError("Rating score must be between 1 and 5", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "booking.rating",
      resource: bookingId,
      status: "success",
      details: {
        actor: auth.session.role,
        score: body.score
      }
    },
    () =>
      TrustedBooking.rate(bookingId, {
        score: body.score!,
        note: body.note?.trim() || "Care completed well",
        ratedBy: auth.session.uid || auth.session.username
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ booking: result.booking });
}
