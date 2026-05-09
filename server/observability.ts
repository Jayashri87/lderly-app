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
  shiftAnalytics: {
    activeShifts: number;
    completedToday: number;
    averageShiftMinutes: number;
    checkinsToday: number;
  };
  slaAnalytics: {
    healthyRate: number;
    breachedRate: number;
    atRiskBookings: number;
  };
  funnelAnalytics: {
    totalEvents: number;
    bookingStarts: number;
    bookingConfirms: number;
    paymentStarts: number;
    paymentConfirms: number;
    emergencyStarts: number;
    caretakerActions: number;
    opsActions: number;
    conversionRate: number;
    paymentCompletionRate: number;
    topEvents: Array<{
      name: string;
      count: number;
    }>;
  };
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

type AttendanceMetricRecord = {
  status?: string;
  durationMinutes?: number;
  events?: Record<
    string,
    {
      action?: string;
    }
  >;
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
      notificationsSnapshot,
      activeShiftsSnapshot,
      attendanceTodaySnapshot,
      analyticsByNameSnapshot,
      analyticsByDateSnapshot
    ] = await Promise.all([
      database.ref("bookings/byId").get(),
      database.ref("caretakers").get(),
      database.ref("supportTickets/byId").get(),
      database.ref("complaints/byId").get(),
      database.ref("refunds/byId").get(),
      database.ref("notifications/byId").get(),
      database.ref("caretakerAttendance/activeShifts").get(),
      database
        .ref(`caretakerAttendance/byDate/${new Date().toISOString().slice(0, 10)}`)
        .get(),
      database.ref("analytics/events/byName").get(),
      database.ref("analytics/events/byDate").get()
    ]);
    const bookings = recordValues<BookingMetricRecord>(bookingsSnapshot.val());
    const caretakers = recordEntries<CaretakerMetricRecord>(caretakersSnapshot.val());
    const supportTickets = recordValues<SupportMetricRecord>(supportSnapshot.val());
    const complaints = recordValues<ComplaintMetricRecord>(complaintsSnapshot.val());
    const refunds = recordValues<RefundMetricRecord>(refundsSnapshot.val());
    const notifications = recordValues<NotificationMetricRecord>(notificationsSnapshot.val());
    const activeShifts = recordValues<AttendanceMetricRecord>(activeShiftsSnapshot.val());
    const attendanceToday = recordEntries<Record<string, boolean>>(
      attendanceTodaySnapshot.val()
    );
    const shiftIdsToday = attendanceToday.flatMap(([, shifts]) => Object.keys(shifts || {}));
    const shiftRecordsToday = await Promise.all(
      attendanceToday.flatMap(([caretakerId, shifts]) =>
        Object.keys(shifts || {}).map(async (shiftId) => {
          const shiftSnapshot = await database
            .ref(`caretakerAttendance/byCaretaker/${caretakerId}/${shiftId}`)
            .get();
          return shiftSnapshot.val() as AttendanceMetricRecord | null;
        })
      )
    );
    const completedShifts = shiftRecordsToday.filter(
      (shift): shift is AttendanceMetricRecord => Boolean(shift?.durationMinutes)
    );
    const checkinsToday = shiftRecordsToday.reduce((total, shift) => {
      const events = Object.values(shift?.events || {});
      return total + events.filter((event) => event.action === "check_in").length;
    }, 0);
    const bookingsByStatus = bookings.reduce<Record<string, number>>((result, booking) => {
      const status = booking.status || "unknown";
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});
    const healthyBookings = bookings.filter((booking) => booking.sla?.status === "healthy").length;
    const breachedBookings = bookings.filter((booking) => booking.sla?.status === "breached")
      .length;
    const eventCounts = Object.entries(
      (analyticsByNameSnapshot.val() || {}) as Record<string, unknown>
    )
      .map(([name, value]) => ({
        name,
        count: countRecord(value)
      }))
      .sort((a, b) => b.count - a.count);
    const eventCountFor = (name: string) =>
      eventCounts.find((event) => event.name === name)?.count || 0;
    const eventCountMatching = (matcher: (name: string) => boolean) =>
      eventCounts.reduce((total, event) => (matcher(event.name) ? total + event.count : total), 0);
    const bookingStarts = eventCountFor("booking_funnel_opened");
    const bookingConfirms = eventCountFor("booking_confirmed");
    const paymentStarts = eventCountFor("payment_checkout_started");
    const paymentConfirms = eventCountFor("payment_confirmed");
    const totalAnalyticsEvents = countNested(analyticsByDateSnapshot.val());
    const activeBookingCount = bookings.filter(
      (booking) =>
        booking.status &&
        !["completed", "payment_settled", "report_generated", "cancelled"].includes(
          booking.status
        )
    ).length;

    return {
      ok: true,
      kpis: {
        generatedAt: Date.now(),
        activeBookings: activeBookingCount,
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
        shiftAnalytics: {
          activeShifts: activeShifts.length,
          completedToday: completedShifts.length,
          averageShiftMinutes: completedShifts.length
            ? Math.round(
                completedShifts.reduce(
                  (total, shift) => total + (shift.durationMinutes || 0),
                  0
                ) / completedShifts.length
              )
            : 0,
          checkinsToday: checkinsToday || shiftIdsToday.length
        },
        slaAnalytics: {
          healthyRate: bookings.length ? Math.round((healthyBookings / bookings.length) * 100) : 100,
          breachedRate: bookings.length
            ? Math.round((breachedBookings / bookings.length) * 100)
            : 0,
          atRiskBookings: bookings.filter((booking) =>
            ["watch", "breached"].includes(booking.sla?.status || "")
          ).length
        },
        funnelAnalytics: {
          totalEvents: totalAnalyticsEvents,
          bookingStarts,
          bookingConfirms,
          paymentStarts,
          paymentConfirms,
          emergencyStarts: eventCountFor("immediate_assistance_requested"),
          caretakerActions: eventCountMatching((name) => name.startsWith("caretaker_")),
          opsActions: eventCountMatching((name) => name.startsWith("ops_")),
          conversionRate: bookingStarts
            ? Math.round((bookingConfirms / bookingStarts) * 100)
            : bookingConfirms
              ? 100
              : 0,
          paymentCompletionRate: paymentStarts
            ? Math.round((paymentConfirms / paymentStarts) * 100)
            : paymentConfirms
              ? 100
              : 0,
          topEvents: eventCounts.slice(0, 6)
        },
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
