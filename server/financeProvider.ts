import { getAdminDatabase } from "./firebaseAdmin";
import type { CareBooking } from "../services/bookingService";

const parseInr = (value: string) => {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount) : 0;
};

const inr = (amount: number) => `Rs ${amount.toLocaleString("en-IN")}`;

export const FinanceProvider = {
  async generateInvoice({
    bookingId,
    gstin = "",
    billTo = ""
  }: {
    bookingId: string;
    gstin?: string;
    billTo?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    const total = parseInr(booking.payment.estimatedTotal);
    const taxableAmount = Math.round(total / 1.18);
    const gstAmount = total - taxableAmount;
    const id = `invoice-${bookingId}`;
    const invoice = {
      id,
      bookingId,
      userId: booking.customerId,
      provider: "lderly",
      paymentId: booking.payment.invoiceId,
      billTo: billTo || booking.customerName,
      gstin,
      currency: "INR",
      taxableAmount,
      gstAmount,
      totalAmount: total,
      displayTaxableAmount: inr(taxableAmount),
      displayGstAmount: inr(gstAmount),
      displayTotalAmount: inr(total),
      lineItems: [
        {
          label: booking.serviceType,
          quantity: 1,
          amount: taxableAmount
        },
        {
          label: "GST 18%",
          quantity: 1,
          amount: gstAmount
        }
      ],
      status: booking.payment.status === "paid" ? "paid" : "issued",
      pdfStatus: "placeholder_ready",
      pdfUrl: "",
      issuedAt: Date.now()
    };

    await database.ref().update({
      [`invoices/byId/${id}`]: invoice,
      [`invoices/byBooking/${bookingId}`]: invoice,
      [`invoices/byUser/${booking.customerId}/${id}`]: true,
      [`bookings/byId/${bookingId}/payment/invoiceId`]: id
    });

    return { ok: true as const, invoice };
  },

  async createPayout({
    bookingId,
    caretakerId,
    incentiveAmount = 0
  }: {
    bookingId: string;
    caretakerId?: string;
    incentiveAmount?: number;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    const assignedCaretaker = caretakerId || booking.caretakerId;

    if (!assignedCaretaker) {
      return { ok: false as const, status: 409, error: "Booking has no caretaker" };
    }

    const total = parseInr(booking.payment.estimatedTotal);
    const basePayout = Math.round(total * 0.65);
    const id = `payout-${bookingId}-${assignedCaretaker}`;
    const payout = {
      id,
      bookingId,
      caretakerId: assignedCaretaker,
      caretakerName: booking.caretakerName,
      grossAmount: total,
      basePayout,
      incentiveAmount,
      totalPayout: basePayout + incentiveAmount,
      status: "pending",
      reconciliationStatus: "pending",
      provider: "manual_bank_transfer",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`payouts/byId/${id}`]: payout,
      [`payouts/byCaretaker/${assignedCaretaker}/${id}`]: true,
      [`payouts/byBooking/${bookingId}`]: payout,
      [`operations/payoutQueue/pending/${id}`]: true
    });

    return { ok: true as const, payout };
  }
};
