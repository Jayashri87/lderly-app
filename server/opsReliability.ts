import { getAdminDatabase } from "./firebaseAdmin";
import { TrustedBooking } from "./trustedBooking";
import type { CareBooking } from "../services/bookingService";
import type { UserRole } from "../services/authService";

export type SupportTicket = {
  id: string;
  userId: string;
  bookingId: string;
  category: "booking" | "payment" | "care_quality" | "emergency" | "technical";
  priority: "normal" | "urgent" | "critical";
  status: "open" | "in_review" | "resolved" | "closed";
  subject: string;
  description: string;
  assignedTo: string;
  createdByRole: UserRole;
  createdAt: number;
  updatedAt: number;
};

export type Complaint = {
  id: string;
  userId: string;
  bookingId: string;
  caretakerId: string;
  type: "delay" | "behavior" | "service_quality" | "billing" | "safety";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "ops_review" | "action_taken" | "resolved";
  summary: string;
  escalationLevel: 1 | 2 | 3;
  createdAt: number;
  updatedAt: number;
};

export type RefundRequest = {
  id: string;
  bookingId: string;
  userId: string;
  provider: "razorpay";
  paymentId: string;
  amountPaise: number;
  reason: string;
  status: "requested" | "processing" | "processed" | "failed";
  providerRefundId: string;
  createdAt: number;
  updatedAt: number;
};

const parseInrToPaise = (value: string) => {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 100) : 0;
};

const writeNotification = async ({
  userId,
  role,
  title,
  body,
  priority = "normal"
}: {
  userId: string;
  role: UserRole | "all";
  title: string;
  body: string;
  priority?: "normal" | "urgent" | "critical";
}) => {
  const database = getAdminDatabase();

  if (!database) {
    return;
  }

  const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const notification = {
    id,
    userId,
    role,
    title,
    body,
    priority,
    channel: "in_app",
    deliveryStatus: "queued",
    read: false,
    createdAt: Date.now()
  };
  const updates: Record<string, unknown> = {
    [`notifications/byId/${id}`]: notification
  };

  if (userId && userId !== "all") {
    updates[`notifications/byUser/${userId}/${id}`] = notification;
  }

  if (role !== "all") {
    updates[`notifications/byRole/${role}/${id}`] = notification;
  }

  await database.ref().update(updates);
};

const getBooking = async (bookingId: string) => {
  const database = getAdminDatabase();

  if (!database) {
    return { database: null, booking: null };
  }

  const snapshot = await database.ref(`bookings/byId/${bookingId}`).get();
  return {
    database,
    booking: snapshot.val() as CareBooking | null
  };
};

export const OpsReliability = {
  async createSupportTicket(
    input: Omit<SupportTicket, "id" | "status" | "assignedTo" | "createdAt" | "updatedAt">
  ) {
    const { database, booking } = await getBooking(input.bookingId);

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    const id = `ticket-${Date.now()}`;
    const ticket: SupportTicket = {
      ...input,
      id,
      status: "open",
      assignedTo: "ops-queue",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`supportTickets/byId/${id}`]: ticket,
      [`supportTickets/byUser/${ticket.userId}/${id}`]: true,
      [`operations/supportQueue/${ticket.priority}/${id}`]: true
    });
    await writeNotification({
      userId: ticket.userId,
      role: "admin",
      title: "New support ticket",
      body: `${ticket.subject} needs ops review.`,
      priority: ticket.priority
    });
    return { ok: true as const, ticket };
  },

  async createComplaint(
    input: Omit<Complaint, "id" | "status" | "escalationLevel" | "createdAt" | "updatedAt">
  ) {
    const { database, booking } = await getBooking(input.bookingId);

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    const id = `complaint-${Date.now()}`;
    const escalationLevel = input.severity === "critical" ? 3 : input.severity === "high" ? 2 : 1;
    const complaint: Complaint = {
      ...input,
      id,
      status: "open",
      escalationLevel,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`complaints/byId/${id}`]: complaint,
      [`complaints/byBooking/${complaint.bookingId}/${id}`]: true,
      [`complaints/byUser/${complaint.userId}/${id}`]: true,
      [`operations/complaintQueue/${complaint.severity}/${id}`]: true
    });
    await writeNotification({
      userId: complaint.userId,
      role: "admin",
      title: "Complaint needs review",
      body: complaint.summary,
      priority: complaint.severity === "critical" ? "critical" : "urgent"
    });
    return { ok: true as const, complaint };
  },

  async requestRefund({
    bookingId,
    reason,
    requestedBy
  }: {
    bookingId: string;
    reason: string;
    requestedBy: UserRole;
  }) {
    const { database, booking } = await getBooking(bookingId);

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (booking.payment.status !== "paid" && booking.payment.status !== "authorized") {
      return { ok: false as const, status: 409, error: "Booking is not eligible for refund" };
    }

    const id = `refund-${Date.now()}`;
    const refund: RefundRequest = {
      id,
      bookingId,
      userId: booking.customerId,
      provider: "razorpay",
      paymentId: booking.payment.invoiceId,
      amountPaise: parseInrToPaise(booking.payment.estimatedTotal),
      reason,
      status: "requested",
      providerRefundId: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`refunds/byId/${id}`]: refund,
      [`refunds/byBooking/${bookingId}/${id}`]: true,
      [`operations/refundQueue/requested/${id}`]: true
    });
    await TrustedBooking.updatePayment(
      bookingId,
      {
        status: "refunded"
      },
      `Refund requested by ${requestedBy}: ${reason}`
    );
    await writeNotification({
      userId: booking.customerId,
      role: "customer",
      title: "Refund request received",
      body: "Our ops team will review and process the refund.",
      priority: "normal"
    });
    return { ok: true as const, refund };
  },

  async broadcastLifecycleUpdate({
    userId,
    bookingId,
    title,
    body,
    priority = "normal"
  }: {
    userId: string;
    bookingId: string;
    title: string;
    body: string;
    priority?: "normal" | "urgent" | "critical";
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    await writeNotification({ userId, role: "customer", title, body, priority });
    await writeNotification({ userId, role: "admin", title, body, priority });
    await database.ref(`operations/communicationLogs/${bookingId}/${Date.now()}`).set({
      userId,
      bookingId,
      title,
      body,
      priority,
      channel: "in_app",
      createdAt: Date.now()
    });
    return { ok: true as const };
  }
};
