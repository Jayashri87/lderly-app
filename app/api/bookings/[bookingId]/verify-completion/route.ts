import { NextRequest, NextResponse } from "next/server";
import {
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
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const { bookingId } = await context.params;
  const body = await parseJsonBody<{ approved?: boolean; note?: string }>(request);
  const approved = body?.approved !== false;

  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.completion.verify",
    `${bookingId}:${approved}:${body?.note?.trim() || ""}`,
    () =>
      withMutationAudit(
        request,
        {
          action: "booking.completion.verify",
          resource: bookingId,
          status: "success",
          details: {
            actor: auth.session.role,
            approved
          }
        },
        () =>
          TrustedBooking.verifyCompletion(
            bookingId,
            {
              approved,
              note: body?.note
            },
            auth.session
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
