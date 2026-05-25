import { NextRequest, NextResponse } from "next/server";
import type { CareBooking } from "../../../services/bookingService";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withIdempotency,
  withMutationAudit
} from "../../../server/apiSecurity";
import { getAdminDatabase } from "../../../server/firebaseAdmin";
import { GoogleWorkspaceProvider } from "../../../server/googleWorkspaceProvider";
import { TrustedBooking } from "../../../server/trustedBooking";

const activePathFor = (role: string, uid?: string, username?: string) => {
  const owner = uid || username;

  if (role === "customer" && owner) {
    return `users/${owner}/activeBookingId`;
  }

  if (role === "caretaker" && owner) {
    return `caretakers/${owner}/activeBookingId`;
  }

  return "operations/activeBookingId";
};

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "caretaker", "admin"], {
    rateLimit: 120,
    csrf: false
  });

  if (!auth.ok) {
    return auth.response;
  }

  const database = getAdminDatabase();

  if (!database) {
    return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
  }

  const bookingIdParam = request.nextUrl.searchParams.get("bookingId");
  const activeBookingIdSnapshot = bookingIdParam
    ? null
    : await database
        .ref(activePathFor(auth.session.role, auth.session.uid, auth.session.username))
        .get();
  const bookingId = bookingIdParam || (activeBookingIdSnapshot?.val() as string | null);

  if (!bookingId) {
    return NextResponse.json({ booking: null, serverTime: Date.now() });
  }

  const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
  const booking = bookingSnapshot.val() as CareBooking | null;

  if (!booking) {
    return NextResponse.json({ booking: null, serverTime: Date.now() });
  }

  const actorId = auth.session.uid || auth.session.username;
  const canRead =
    auth.session.role === "admin" ||
    (auth.session.role === "customer" && booking.customerId === actorId) ||
    (auth.session.role === "caretaker" &&
      (booking.caretakerId === actorId || Boolean(booking.dispatch?.offers?.[actorId || ""])));

  if (!canRead) {
    return jsonError("Forbidden", 403);
  }

  return NextResponse.json({ booking, serverTime: Date.now() });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ booking?: CareBooking }>(request);

  if (!body?.booking) {
    return jsonError("Booking payload is required", 400);
  }

  const idempotent = await withIdempotency(
    request,
    auth.session,
    "booking.create",
    body.booking.id,
    () =>
      withMutationAudit(
        request,
        {
          action: "booking.create",
          resource: body.booking!.id,
          status: "success",
          details: {
            actor: auth.session.role,
            customerId: body.booking!.customerId,
            serviceType: body.booking!.serviceType
          }
        },
        () => TrustedBooking.create(body.booking as CareBooking)
      )
  );
  const result = idempotent.value;

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (!idempotent.replayed) {
    const calendarResult = await GoogleWorkspaceProvider.createOpsCalendarEvent(result.booking);
    const [opsSheetResult, dispatchSheetResult] = await Promise.all([
      GoogleWorkspaceProvider.appendBookingToOpsSheet(result.booking, calendarResult),
      GoogleWorkspaceProvider.appendDispatchToOpsSheet(result.booking)
    ]);
    const database = getAdminDatabase();

    if (database) {
      await database.ref(`bookings/byId/${result.booking.id}/integrations`).update({
        googleCalendar: {
          provider: "google_workspace",
          status: calendarResult.ok ? "synced" : "not_synced",
          updatedAt: Date.now(),
          ...(calendarResult.ok
            ? { eventId: calendarResult.id || "", eventUrl: calendarResult.url || "" }
            : { error: calendarResult.error, httpStatus: calendarResult.status })
        },
        googleOpsSheet: {
          provider: "google_workspace",
          status: opsSheetResult.ok ? "synced" : "not_synced",
          updatedAt: Date.now(),
          ...(opsSheetResult.ok
            ? { range: opsSheetResult.id || "", url: opsSheetResult.url || "" }
            : { error: opsSheetResult.error, httpStatus: opsSheetResult.status })
        },
        googleDispatchSheet: {
          provider: "google_workspace",
          status: dispatchSheetResult.ok ? "synced" : "not_synced",
          updatedAt: Date.now(),
          ...(dispatchSheetResult.ok
            ? { range: dispatchSheetResult.id || "", url: dispatchSheetResult.url || "" }
            : { error: dispatchSheetResult.error, httpStatus: dispatchSheetResult.status })
        }
      });
    }
  }

  return NextResponse.json(
    { booking: result.booking, replayed: idempotent.replayed },
    { headers: idempotent.replayed ? { "x-idempotent-replay": "true" } : undefined }
  );
}

