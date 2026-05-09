import { getAdminDatabase } from "./firebaseAdmin";
import type { UserRole } from "../services/authService";

export type AnalyticsEvent = {
  id: string;
  name: string;
  userId: string;
  role: UserRole | "system";
  bookingId?: string;
  properties: Record<string, unknown>;
  createdAt: number;
};

export type OpsKpis = {
  generatedAt: number;
  activeBookings: number;
  bookingsByStatus: Record<string, number>;
  onlineCaretakers: number;
  slaWatch: number;
  slaBreached: number;
  supportOpen: number;
  complaintsOpen: number;
  refundsRequested: number;
  notificationsQueued: number;
  caregiverPerformance: Array<{
    uid: string;
    name: string;
    rating: number;
    punctualityScore: number;
    activeAssignments: number;
    status: string;
  }>;
  monitoring: {
    sentryConfigured: boolean;
    posthogConfigured: boolean;
    mixpanelConfigured: boolean;
    crashlyticsPlaceholder: boolean;
  };
};

type BookingMetricRecord = {
  status?: string;
  sla?: {
    status?: string;
  };
};

type CaretakerMetricRecord = {
  name?: string;
  rating?: number;
  punctualityScore?: number;
  activeAssignments?: number;
  available?: boolean;
  status?: string;
};

type SupportMetricRecord = {
  status?: string;
};

type ComplaintMetricRecord = {
  status?: string;
};

type RefundMetricRecord = {
  status?: string;
};

type NotificationMetricRecord = {
  deliveryStatus?: string;
};

const countRecord = (value: unknown) =>
  value && typeof value === "object" ? Object.keys(value as Record<string, unknown>).length : 0;

const countNested = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return 0;
  }

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (total, nested) => total + countRecord(nested),
    0
  );
};

const recordValues = <T>(value: unknown) =>
  Object.values((value || {}) as Record<string, T>);

const recordEntries = <T>(value: unknown) =>
  Object.entries((value || {}) as Record<string, T>);

export const Observability = {
  async captureEvent({
    name,
    userId,
    role,
    bookingId,
    properties = {}
  }: Omit<AnalyticsEvent, "id" | "createdAt">) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const event: AnalyticsEvent = {
      id,
      name,
      userId,
      role,
      bookingId,
      properties,
      createdAt: Date.now()
    };
    const dateKey = new Date(event.createdAt).toISOString().slice(0, 10);
    const updates: Record<string, unknown> = {
      [`analytics/events/byId/${id}`]: event,
      [`analytics/events/byDate/${dateKey}/${id}`]: true,
      [`analytics/events/byName/${name}/${id}`]: true
    };

    if (bookingId) {
      updates[`analytics/events/byBooking/${bookingId}/${id}`] = true;
    }

    await database.ref().update(updates);
    return { ok: true as const, event };
  },

  async getOpsKpis(): Promise<
    | {
        ok: true;
        kpis: OpsKpis;
      }
    | {
        ok: false;
        status: number;
        error: string;
      }
  > {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false, status: 503, error: "Firebase Admin is not configured" };
    }

    const [
      bookingsSnapshot,
      caretakersSnapshot,
      supportSnapshot,
      complaintsSnapshot,
      refundsSnapshot,
      notificationsSnapshot
    ] = await Promise.all([
      database.ref("bookings/byId").get(),
      database.ref("caretakers").get(),
      database.ref("supportTickets/byId").get(),
      database.ref("complaints/byId").get(),
      database.ref("refunds/byId").get(),
      database.ref("notifications/byId").get()
    ]);
    const bookings = recordValues<BookingMetricRecord>(bookingsSnapshot.val());
    const caretakers = recordEntries<CaretakerMetricRecord>(caretakersSnapshot.val());
    const supportTickets = recordValues<SupportMetricRecord>(supportSnapshot.val());
    const complaints = recordValues<ComplaintMetricRecord>(complaintsSnapshot.val());
    const refunds = recordValues<RefundMetricRecord>(refundsSnapshot.val());
    const notifications = recordValues<NotificationMetricRecord>(notificationsSnapshot.val());
    const bookingsByStatus = bookings.reduce<Record<string, number>>((result, booking) => {
      const status = booking.status || "unknown";
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});

    return {
      ok: true,
      kpis: {
        generatedAt: Date.now(),
        activeBookings: bookings.filter(
          (booking) =>
            booking.status &&
            !["completed", "payment_settled", "report_generated", "cancelled"].includes(
              booking.status
            )
        ).length,
        bookingsByStatus,
        onlineCaretakers: caretakers.filter(([, caretaker]) => caretaker.available)
          .length,
        slaWatch: bookings.filter((booking) => booking.sla?.status === "watch").length,
        slaBreached: bookings.filter((booking) => booking.sla?.status === "breached").length,
        supportOpen: supportTickets.filter((ticket) =>
          ["open", "in_review"].includes(ticket.status || "")
        ).length,
        complaintsOpen: complaints.filter((complaint) =>
          ["open", "ops_review"].includes(complaint.status || "")
        ).length,
        refundsRequested: refunds.filter((refund) =>
          ["requested", "processing"].includes(refund.status || "")
        ).length,
        notificationsQueued: notifications.filter((notification) =>
          ["pending", "queued"].includes(notification.deliveryStatus || "")
        ).length,
        caregiverPerformance: caretakers.map(([uid, caretaker]) => ({
          uid,
          name: caretaker.name || uid,
          rating: caretaker.rating || 0,
          punctualityScore: caretaker.punctualityScore || 0,
          activeAssignments: caretaker.activeAssignments || 0,
          status: caretaker.status || (caretaker.available ? "available" : "offline")
        })),
        monitoring: {
          sentryConfigured: Boolean(process.env.SENTRY_DSN),
          posthogConfigured: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
          mixpanelConfigured: Boolean(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN),
          crashlyticsPlaceholder: true
        }
      }
    };
  },

  async writeDailySnapshot() {
    const result = await this.getOpsKpis();

    if (!result.ok) {
      return result;
    }

    const database = getAdminDatabase();
    const dateKey = new Date(result.kpis.generatedAt).toISOString().slice(0, 10);

    await database?.ref(`analytics/dailySnapshots/${dateKey}`).set({
      ...result.kpis,
      source: "server"
    });
    return result;
  },

  async getEventCounts() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [byNameSnapshot, byDateSnapshot] = await Promise.all([
      database.ref("analytics/events/byName").get(),
      database.ref("analytics/events/byDate").get()
    ]);

    return {
      ok: true as const,
      counts: {
        byName: Object.fromEntries(
          Object.entries((byNameSnapshot.val() || {}) as Record<string, unknown>).map(
            ([key, value]) => [key, countRecord(value)]
          )
        ),
        totalByDate: Object.fromEntries(
          Object.entries((byDateSnapshot.val() || {}) as Record<string, unknown>).map(
            ([key, value]) => [key, countRecord(value)]
          )
        ),
        total: countNested(byDateSnapshot.val())
      }
    };
  }
};
