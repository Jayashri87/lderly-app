import { createHmac, timingSafeEqual } from "node:crypto";
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

const parseInrAmount = (value: string) => {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 10000;
  }

  return Math.max(100, Math.round(numeric * 100));
};

export const createCheckout = async ({
  booking,
  origin
}: {
  booking: CareBooking;
  origin: string;
}): Promise<CheckoutResult> => {
  const amount = parseInrAmount(booking.payment.estimatedTotal);
  const currency = "INR" as const;

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
      Authorization: `Basic ${Buffer.from(
        `${razorpayKeyId}:${razorpayKeySecret}`
      ).toString("base64")}`,
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
  !hasRazorpayConfig &&
  allowMockProviders &&
  orderId.startsWith("mock-razorpay-order-");

export const verifyRazorpayWebhook = (body: string, signature: string | null) => {
  if (!hasRazorpayWebhookConfig || !signature) {
    return false;
  }

  const expected = createHmac("sha256", razorpayWebhookSecret)
    .update(body)
    .digest("hex");
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    provided.length === expectedBuffer.length &&
    timingSafeEqual(provided, expectedBuffer)
  );
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
  if (!razorpayKeySecret) {
    return false;
  }

  const expected = createHmac("sha256", razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    provided.length === expectedBuffer.length &&
    timingSafeEqual(provided, expectedBuffer)
  );
};
