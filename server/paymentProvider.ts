import { createHmac, timingSafeEqual } from "node:crypto";
import {
  parseInrToPaise,
  validateRazorpayPaymentAgainstBooking,
  verifyRazorpayOrderPaymentSignature,
  type RazorpayPaymentRecord
} from "@lderly/payment";
import type { CareBooking } from "../services/bookingService";
import {
  allowMockProviders,
  assertMockProviderAllowed,
  mockProvidersFailClosed
} from "./mockProviderPolicy";

export type CheckoutResult = {
  mode: "razorpay" | "mock";
  provider: "razorpay";
  orderId: string;
  keyId: string;
  amount: number;
  currency: "INR";
  customerName: string;
  description: string;
  mockCheckoutUrl?: string;
};

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export const hasRazorpayConfig = Boolean(razorpayKeyId && razorpayKeySecret);
export const hasRazorpayWebhookConfig = Boolean(razorpayWebhookSecret);
export const paymentMockFailClosed = mockProvidersFailClosed || hasRazorpayConfig;

export const createCheckout = async ({
  booking,
  origin
}: {
  booking: CareBooking;
  origin: string;
}): Promise<CheckoutResult> => {
  const amount = parseInrToPaise(booking.payment.estimatedTotal);
  const currency = "INR" as const;

  if (!amount) {
    throw new Error("Booking amount is not ready for payment");
  }

  if (!hasRazorpayConfig) {
    assertMockProviderAllowed("Razorpay checkout");

    return {
      mode: "mock",
      provider: "razorpay",
      orderId: `mock-razorpay-order-${Date.now()}`,
      keyId: "mock_razorpay_key",
      amount,
      currency,
      customerName: booking.customerName,
      description: booking.serviceType,
      mockCheckoutUrl: `${origin}/?payment=mock-authorized&bookingId=${encodeURIComponent(
        booking.id
      )}`
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
        "base64"
      )}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt: booking.id.slice(0, 40),
      notes: {
        bookingId: booking.id,
        customerId: booking.customerId,
        serviceType: booking.serviceType
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Razorpay order creation failed: ${response.status}`);
  }

  const payload = (await response.json()) as { id: string };

  return {
    mode: "razorpay",
    provider: "razorpay",
    orderId: payload.id,
    keyId: razorpayKeyId,
    amount,
    currency,
    customerName: booking.customerName,
    description: booking.serviceType
  };
};

export const isMockPaymentConfirmationAllowed = (orderId: string) =>
  !hasRazorpayConfig && allowMockProviders && orderId.startsWith("mock-razorpay-order-");

export const verifyRazorpayWebhook = (body: string, signature: string | null) => {
  if (!hasRazorpayWebhookConfig || !signature) {
    return false;
  }

  const expected = createHmac("sha256", razorpayWebhookSecret).update(body).digest("hex");
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
};

export const verifyRazorpayPayment = ({
  orderId,
  paymentId,
  signature
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) => {
  return verifyRazorpayOrderPaymentSignature({
    orderId,
    paymentId,
    signature,
    keySecret: razorpayKeySecret
  });
};

export const fetchRazorpayPayment = async (paymentId: string) => {
  if (!hasRazorpayConfig) {
    throw new Error("Razorpay is not configured");
  }

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
        "base64"
      )}`
    }
  });

  if (!response.ok) {
    throw new Error(`Razorpay payment fetch failed: ${response.status}`);
  }

  return (await response.json()) as RazorpayPaymentRecord;
};

export const validateRazorpayPaymentForBooking = async ({
  booking,
  orderId,
  paymentId,
  signature
}: {
  booking: CareBooking;
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (
    !verifyRazorpayPayment({
      orderId,
      paymentId,
      signature
    })
  ) {
    return { ok: false, error: "Invalid Razorpay signature" };
  }

  if (booking.payment?.invoiceId && booking.payment.invoiceId !== orderId) {
    return { ok: false, error: "Razorpay order does not match this booking" };
  }

  const expectedAmountPaise = parseInrToPaise(booking.payment.estimatedTotal);

  if (!expectedAmountPaise) {
    return { ok: false, error: "Booking amount is not ready for payment" };
  }

  const payment = await fetchRazorpayPayment(paymentId);

  return validateRazorpayPaymentAgainstBooking({
    payment,
    expectedOrderId: orderId,
    expectedAmountPaise
  });
};
