import type {
  BookingPayment,
  BookingStatus,
  CareBooking,
  CaretakerMatchProfile
} from "../services/bookingService";
import { getAdminDatabase } from "./firebaseAdmin";
import { enrichBookingLocation } from "./locationProvider";

const transitionMap: Record<BookingStatus, BookingStatus[]> = {
  none: ["requested"],
  requested: ["assigned", "cancelled"],
  assigned: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

const stepLabels: Record<BookingStatus, string> = {
  none: "No booking",
  requested: "Request Created",
  assigned: "Caregiver Assigned",
  accepted: "Caregiver Accepted",
  in_progress: "Session Started",
  completed: "Session Completed",
  cancelled: "Booking Cancelled"
};

const dateKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const hourKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 13);

const canTransition = (from: BookingStatus, to: BookingStatus) =>
  transitionMap[from]?.includes(to) || from === to;

const lifecycleFor = (
  status: BookingStatus,
  actor: "customer" | "caretaker" | "admin" | "system" = "system"
) => {
  const allowedNextStatuses = transitionMap[status];
  const nextStatus = allowedNextStatuses[0] ?? status;

  return {
    allowedNextStatuses,
    currentStep: stepLabels[status],
    nextStep: stepLabels[nextStatus],
    lastActor: actor
  };
};

const enrichBooking = (
  booking: CareBooking,
  actor: "customer" | "caretaker" | "admin" | "system" = "system"
): CareBooking => ({
  ...booking,
  updatedAt: Date.now(),
  lifecycle: lifecycleFor(booking.status, actor),
  scheduleIndex: {
    dateKey: dateKeyFor(booking.scheduledFor),
    hourKey: hourKeyFor(booking.scheduledFor),
    statusKey: booking.status,
    city: booking.matching?.city || "Bengaluru",
    zone: booking.matching?.zone || "Central"
  }
});

const bookingIndexes = (booking: CareBooking) => {
  const updates: Record<string, unknown> = {
    [`bookings/byId/${booking.id}`]: booking,
    [`users/${booking.customerId}/activeBookingId`]: booking.id,
    "operations/activeBookingId": booking.id,
    [`operations/bookingsByStatus/${booking.status}/${booking.id}`]: true,
    [`operations/bookingsByDate/${booking.scheduleIndex.dateKey}/${booking.id}`]: true,
    [`operations/bookingsByZone/${booking.scheduleIndex.zone}/${booking.id}`]: true,
    [`operations/bookingsByCustomer/${booking.customerId}/${booking.id}`]: true
  };

  if (booking.caretakerId) {
    updates[`caretakers/${booking.caretakerId}/activeBookingId`] = booking.id;
    updates[`operations/bookingsByCaretaker/${booking.caretakerId}/${booking.id}`] =
      true;
  }

  return updates;
};

const scoreCaretaker = (booking: CareBooking, caretaker: CaretakerMatchProfile) => {
  const skillMatches = booking.matching.requiredSkills.filter((skill) =>
    caretaker.skills?.includes(skill)
  ).length;
  const languageMatches = booking.matching.preferredLanguages.filter((language) =>
    caretaker.languages?.includes(language)
  ).length;
  const zoneScore = caretaker.zone === booking.matching.zone ? 2 : 0;
  const capacityScore =
    caretaker.activeAssignments < caretaker.maxAssignments ? 2 : -10;
  const trustScore = (caretaker.verified ? 1 : 0) + (caretaker.trained ? 1 : 0);

  return (
    skillMatches * 4 +
    languageMatches +
    zoneScore +
    capacityScore +
    trustScore +
    caretaker.rating
  );
};

export const TrustedBooking = {
  async create(booking: CareBooking) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    if (!canTransition("none", booking.status)) {
      return { ok: false as const, status: 400, error: "Invalid initial booking status" };
    }

    const locationReadyBooking = await enrichBookingLocation(booking);
    const safeBooking = enrichBooking(locationReadyBooking, "system");
    await database.ref().update(bookingIndexes(safeBooking));
    return { ok: true as const, booking: safeBooking };
  },

  async assign(bookingId: string) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (!canTransition(booking.status, "assigned")) {
      return { ok: false as const, status: 409, error: "Invalid booking transition" };
    }

    const caretakerSnapshot = await database.ref("caretakers").get();
    const caretakers = Object.values(
      (caretakerSnapshot.val() as Record<string, CaretakerMatchProfile> | null) || {}
    ).filter((caretaker) => caretaker.available);
    const bestCaretaker =
      caretakers.sort((a, b) => scoreCaretaker(booking, b) - scoreCaretaker(booking, a))[0] ||
      null;

    if (!bestCaretaker) {
      return { ok: false as const, status: 409, error: "No available caretaker" };
    }

    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "assigned",
        caretakerId: bestCaretaker.uid,
        caretakerName: bestCaretaker.name,
        timeline: [
          ...booking.timeline,
          { label: `Server assigned ${bestCaretaker.name}`, at: Date.now() }
        ]
      },
      "admin"
    );

    await database.ref().update(bookingIndexes(nextBooking));
    return { ok: true as const, booking: nextBooking };
  },

  async updateStatus(bookingId: string, status: BookingStatus) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (!canTransition(booking.status, status)) {
      return { ok: false as const, status: 409, error: "Invalid booking transition" };
    }

    const nextBooking = enrichBooking(
      {
        ...booking,
        status,
        timeline: [...booking.timeline, { label: stepLabels[status], at: Date.now() }]
      },
      "admin"
    );

    await database.ref().update(bookingIndexes(nextBooking));
    return { ok: true as const, booking: nextBooking };
  },

  async updatePayment(
    bookingId: string,
    payment: Partial<BookingPayment>,
    label = "Payment updated"
  ) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    const nextBooking = enrichBooking(
      {
        ...booking,
        payment: {
          ...booking.payment,
          ...payment
        },
        timeline: [...booking.timeline, { label, at: Date.now() }]
      },
      "admin"
    );

    await database.ref().update(bookingIndexes(nextBooking));
    return { ok: true as const, booking: nextBooking };
  }
};
