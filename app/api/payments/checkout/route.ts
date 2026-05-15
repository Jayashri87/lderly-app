import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { getAdminDatabase } from "../../../../server/firebaseAdmin";
import { createCheckout } from "../../../../server/paymentProvider";
import { TrustedBooking } from "../../../../server/trustedBooking";
import type { CareBooking } from "../../../../services/bookingService";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ bookingId?: string }>(request);

  if (!body?.bookingId) {
    return jsonError("Booking id is required", 400);
  }

  const database = getAdminDatabase();

  if (!database) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured" },
      { status: 503 }
    );
  }

  const bookingSnapshot = await database.ref(`bookings/byId/${body.bookingId}`).get();
  const booking = bookingSnapshot.val() as CareBooking | null;

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (auth.session.role !== "admin" && booking.customerId !== auth.session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let checkout;

  try {
    checkout = await createCheckout({
      booking,
      origin: request.nextUrl.origin
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment provider is not available"
      },
      { status: 503 }
    );
  }

  await withMutationAudit(
    request,
    {
      action: "payment.checkout",
      resource: booking.id,
      status: "success",
      details: {
        provider: checkout.provider,
        mode: checkout.mode,
        orderId: checkout.orderId
      }
    },
    () =>
      TrustedBooking.updatePayment(
        booking.id,
        {
          method: "upi",
          status: "authorized",
          invoiceId: checkout.orderId
        },
        checkout.mode === "razorpay"
          ? "Razorpay order created"
          : "Mock payment authorized"
      )
  );

  return NextResponse.json(checkout);
}

