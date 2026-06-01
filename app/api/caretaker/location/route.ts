import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { getAdminDatabase } from "../../../../server/firebaseAdmin";
import { canUpdateBookingLocation } from "../../../../server/realtimeAccess";
import { TrustedBooking } from "../../../../server/trustedBooking";
import type { CareBooking } from "../../../../services/bookingService";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["caretaker", "admin"], { rateLimit: 180 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    caretakerId?: string;
    bookingId?: string;
    lat?: number;
    lng?: number;
    accuracyMeters?: number;
    capturedAt?: number;
    source?: "device" | "background";
  }>(request);
  const caretakerId =
    auth.session.role === "admin"
      ? body?.caretakerId || auth.session.uid || auth.session.username
      : auth.session.uid || auth.session.username;

  if (
    !body ||
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    Math.abs(body.lat) > 90 ||
    Math.abs(body.lng) > 180
  ) {
    return jsonError("Valid latitude and longitude are required", 400);
  }

  if (body.bookingId) {
    const database = getAdminDatabase();

    if (!database) {
      return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${body.bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return jsonError("Booking not found", 404);
    }

    if (!canUpdateBookingLocation(auth.session, booking)) {
      return jsonError("Forbidden", 403);
    }
  }

  const result = await withMutationAudit(
    request,
    {
      action: "caretaker.location",
      resource: caretakerId,
      status: "success",
      details: {
        actor: auth.session.role,
        bookingId: body.bookingId || "",
        source: body.source || "device"
      }
    },
    () =>
      TrustedBooking.updateCaretakerLocation(
        caretakerId,
        {
          lat: body.lat!,
          lng: body.lng!,
          accuracyMeters: body.accuracyMeters,
          capturedAt: body.capturedAt
        },
        body.bookingId
      )
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
