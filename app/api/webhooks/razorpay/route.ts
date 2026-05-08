import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "../../../../server/paymentProvider";
import { TrustedBooking } from "../../../../server/trustedBooking";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        notes?: {
          bookingId?: string;
        };
      };
    };
    order?: {
      entity?: {
        id?: string;
        notes?: {
          bookingId?: string;
        };
      };
    };
  };
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhook(body, signature)) {
    return NextResponse.json(
      { error: "Invalid or unconfigured Razorpay webhook" },
      { status: 400 }
    );
  }

  const event = JSON.parse(body) as RazorpayWebhookPayload;

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;
    const bookingId = payment?.notes?.bookingId || order?.notes?.bookingId;

    if (bookingId) {
      await TrustedBooking.updatePayment(
        bookingId,
        {
          method: "upi",
          status: "paid",
          invoiceId: payment?.id || order?.id || ""
        },
        "Razorpay payment completed"
      );
    }
  }

  return NextResponse.json({ received: true });
}
