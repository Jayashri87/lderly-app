import { NextRequest, NextResponse } from "next/server";
import type { CareBooking } from "../../../services/bookingService";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../server/apiSecurity";
import { TrustedBooking } from "../../../server/trustedBooking";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ booking?: CareBooking }>(request);

  if (!body?.booking) {
    return jsonError("Booking payload is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "booking.create",
      resource: body.booking.id,
      status: "success",
      details: {
        actor: auth.session.role,
        customerId: body.booking.customerId,
        serviceType: body.booking.serviceType
      }
    },
    () => TrustedBooking.create(body.booking as CareBooking)
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ booking: result.booking });
}

