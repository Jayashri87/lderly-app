import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";

export type RazorpayPaymentVerificationInput = {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
};

export type RazorpayPaymentRecord = {
  id: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: RazorpayPaymentStatus | string;
  captured?: boolean;
};

export const parseInrToPaise = (value: string) => {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.max(100, Math.round(numeric * 100));
};

export const verifyRazorpayOrderPaymentSignature = ({
  orderId,
  paymentId,
  signature,
  keySecret
}: RazorpayPaymentVerificationInput) => {
  if (!orderId || !paymentId || !signature || !keySecret) {
    return false;
  }

  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
};

export const isRazorpayPaymentUsableForDispatch = (
  payment: Pick<RazorpayPaymentRecord, "status" | "captured">
) => payment.status === "captured" || payment.status === "authorized" || payment.captured === true;

export const validateRazorpayPaymentAgainstBooking = ({
  payment,
  expectedOrderId,
  expectedAmountPaise
}: {
  payment: RazorpayPaymentRecord;
  expectedOrderId: string;
  expectedAmountPaise: number;
}): { ok: true } | { ok: false; error: string } => {
  if (payment.order_id !== expectedOrderId) {
    return { ok: false, error: "Razorpay payment order mismatch" };
  }

  if (payment.currency !== "INR") {
    return { ok: false, error: "Razorpay payment currency mismatch" };
  }

  if (!isRazorpayPaymentUsableForDispatch(payment)) {
    return { ok: false, error: "Razorpay payment is not captured or authorized" };
  }

  if (payment.amount !== expectedAmountPaise) {
    return { ok: false, error: "Razorpay payment amount mismatch" };
  }

  return { ok: true };
};
