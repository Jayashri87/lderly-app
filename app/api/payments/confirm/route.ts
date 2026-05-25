import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withIdempotency,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { getAdminDatabase } from "../../../../server/firebaseAdmin";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";
import {
  hasRazorpayConfig,
  isMockPaymentConfirmationAllowed,
  verifyRazorpayPayment
} from "../../../../server/paymentProvider";
import { TrustedBooking } from "../../../../server/trustedBooking";
import type { CareBooking } from "../../../../services/bookingService";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    bookingId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }>(request);

  if (!body?.bookingId || !body.razorpay_order_id || !body.razorpay_payment_id) {
    return jsonError("Booking id and Razorpay payment details are required", 400);
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

  const signatureVerified =
    hasRazorpayConfig
      ? verifyRazorpayPayment({
          orderId: body.razorpay_order_id,
          paymentId: body.razorpay_payment_id,
          signature: body.razorpay_signature || ""
        })
      : isMockPaymentConfirmationAllowed(body.razorpay_order_id);

  if (!signatureVerified) {
    await withMutationAudit(
      request,
      {
        action: "payment.confirm_failed",
        resource: booking.id,
        status: "failure",
        details: {
          orderId: body.razorpay_order_id
        }
      },
      () =>
        TrustedBooking.updatePayment(
          booking.id,
          {
            status: "failed",
            invoiceId: body.razorpay_order_id
          },
          "Razorpay signature verification failed"
        )
    );

    await GoogleWorkspaceProvider.appendPaymentToOpsSheet({
      booking,
      event: "payment_verification_failed",
      provider: "razorpay",
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      status: "failed",
      actor: auth.session.role
    });

    return jsonError("Invalid Razorpay signature", 400);
  }

  const idempotent = await withIdempotency(
    request,
    auth.session,
    "payment.confirm",
    `${booking.id}:${body.razorpay_order_id}:${body.razorpay_payment_id}`,
    () =>
      withMutationAudit(
        request,
        {
          action: "payment.confirm",
          resource: booking.id,
          status: "success",
          details: {
            orderId: body.razorpay_order_id,
            paymentId: body.razorpay_payment_id
          }
        },
        () =>
          TrustedBooking.updatePayment(
            booking.id,
            {
              method: "upi",
              status: "paid",
              invoiceId: body.razorpay_payment_id
            },
            "Razorpay payment confirmed"
          )
      )
  );
  const result = idempotent.value;

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (!idempotent.replayed) {
    await GoogleWorkspaceProvider.appendPaymentToOpsSheet({
      booking: result.booking,
      event: "payment_confirmed",
      provider: "razorpay",
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      status: "paid",
      actor: auth.session.role
    });
  }

  return NextResponse.json(
    { ok: true, booking: result.booking, replayed: idempotent.replayed },
    { headers: idempotent.replayed ? { "x-idempotent-replay": "true" } : undefined }
  );
}

