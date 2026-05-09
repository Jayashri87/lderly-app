import type {
  BookingPayment,
  BookingStatus,
  CareBooking,
  CareLocation,
  CaretakerMatchProfile
} from "../services/bookingService";
import { getAdminDatabase } from "./firebaseAdmin";
import { enrichBookingLocation } from "./locationProvider";

const transitionMap: Record<BookingStatus, BookingStatus[]> = {
  none: ["requested"],
  requested: ["searching", "assigned", "cancelled"],
  searching: ["assigned", "cancelled"],
  assigned: ["accepted", "cancelled"],
  accepted: ["en_route", "arrived", "in_progress", "cancelled"],
  en_route: ["arrived", "in_progress", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["payment_settled", "report_generated"],
  payment_settled: ["report_generated"],
  report_generated: [],
  cancelled: []
};

const stepLabels: Record<BookingStatus, string> = {
  none: "No booking",
  requested: "Request Created",
  searching: "Finding Caregiver",
  assigned: "Caregiver Assigned",
  accepted: "Caregiver Accepted",
  en_route: "Caregiver En Route",
  arrived: "Caregiver Arrived",
  in_progress: "Session Started",
  completed: "Session Completed",
  payment_settled: "Payment Settled",
  report_generated: "Report Generated",
  cancelled: "Booking Cancelled"
};

const dateKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const hourKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 13);

const canTransition = (from: BookingStatus, to: BookingStatus) =>
  transitionMap[from]?.includes(to) || from === to;

const terminalStatuses: BookingStatus[] = [
  "completed",
  "payment_settled",
  "report_generated",
  "cancelled"
];

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
): CareBooking => {
  const timestamp = Date.now();
  const assignmentDueAt = booking.sla?.assignmentDueAt || booking.createdAt + 10 * 60 * 1000;
  const arrivalDueAt = booking.sla?.arrivalDueAt || booking.scheduledFor + 20 * 60 * 1000;
  const assignmentPending = ["requested", "searching"].includes(booking.status);
  const arrivalPending = ["assigned", "accepted", "en_route"].includes(booking.status);
  const breached =
    (assignmentPending && timestamp > assignmentDueAt) ||
    (arrivalPending && timestamp > arrivalDueAt);
  const watch =
    (assignmentPending && timestamp > assignmentDueAt - 3 * 60 * 1000) ||
    (arrivalPending && timestamp > arrivalDueAt - 5 * 60 * 1000);

  return {
    ...booking,
    updatedAt: timestamp,
    lifecycle: lifecycleFor(booking.status, actor),
    scheduleIndex: {
      dateKey: dateKeyFor(booking.scheduledFor),
      hourKey: hourKeyFor(booking.scheduledFor),
      statusKey: booking.status,
      city: booking.matching?.city || "Bengaluru",
      zone: booking.matching?.zone || "Central"
    },
    tracking: {
      etaMinutes: booking.tracking?.etaMinutes ?? 10,
      distanceKm: booking.tracking?.distanceKm ?? 3.2,
      destinationLabel: booking.tracking?.destinationLabel || "Care location",
      customerLocation: booking.tracking?.customerLocation || { lat: 12.9716, lng: 77.5946 },
      caretakerLocation: booking.tracking?.caretakerLocation || { lat: 12.985, lng: 77.61 },
      lastLocationAt: booking.tracking?.lastLocationAt || timestamp,
      routeStatus: terminalStatuses.includes(booking.status)
        ? "completed"
        : booking.status === "arrived" || booking.status === "in_progress"
          ? "arrived"
          : booking.status === "en_route"
            ? "tracking"
            : booking.tracking?.routeStatus || "pending"
    },
    sla: {
      assignmentDueAt,
      arrivalDueAt,
      status: breached ? "breached" : watch ? "watch" : booking.sla?.status || "healthy",
      breachReason: breached
        ? assignmentPending
          ? "Assignment SLA breached"
          : "Arrival SLA breached"
        : ""
    }
  };
};

const bookingIndexes = (booking: CareBooking, previous?: CareBooking) => {
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

  if (previous) {
    updates[`operations/bookingsByStatus/${previous.status}/${previous.id}`] = null;
    updates[`operations/bookingsByDate/${previous.scheduleIndex?.dateKey}/${previous.id}`] = null;
    updates[`operations/bookingsByZone/${previous.scheduleIndex?.zone}/${previous.id}`] = null;
    if (previous.caretakerId && previous.caretakerId !== booking.caretakerId) {
      updates[`caretakers/${previous.caretakerId}/activeBookingId`] = null;
      updates[`operations/bookingsByCaretaker/${previous.caretakerId}/${previous.id}`] = null;
    }
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
  const serviceZoneScore = caretaker.serviceZones?.includes(booking.matching.zone) ? 3 : 0;
  const preferredScore = caretaker.uid === booking.matching.preferredCaretakerId ? 5 : 0;
  const familiarScore = caretaker.familiarFamilies?.includes(booking.customerId) ? 4 : 0;
  const capacityScore =
    caretaker.activeAssignments < caretaker.maxAssignments ? 2 : -10;
  const trustScore =
    (caretaker.verified ? 1 : 0) +
    (caretaker.trained ? 1 : 0) +
    ((caretaker.punctualityScore || 0) / 100);

  return (
    skillMatches * 4 +
    languageMatches +
    zoneScore +
    serviceZoneScore +
    preferredScore +
    familiarScore +
    capacityScore +
    trustScore +
    caretaker.rating
  );
};

const etaFromDistance = (km: number) => Math.max(3, Math.round(km * 4 + 2));

const distanceKm = (from: CareLocation, to: CareLocation) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Number((earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
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
    ).filter(
      (caretaker) =>
        caretaker.available &&
        caretaker.status !== "offline" &&
        caretaker.status !== "on_visit" &&
        caretaker.activeAssignments < caretaker.maxAssignments
    );
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
        tracking: {
          ...(booking.tracking || {
            customerLocation: { lat: 12.9716, lng: 77.5946 },
            caretakerLocation: { lat: 12.985, lng: 77.61 },
            destinationLabel: "Care location",
            distanceKm: 3.2,
            etaMinutes: 10,
            lastLocationAt: Date.now(),
            routeStatus: "pending" as const
          }),
          caretakerLocation: bestCaretaker.currentLocation ||
            booking.tracking?.caretakerLocation || { lat: 12.985, lng: 77.61 },
          etaMinutes: etaFromDistance(
            distanceKm(
              bestCaretaker.currentLocation ||
                booking.tracking?.caretakerLocation || { lat: 12.985, lng: 77.61 },
              booking.tracking?.customerLocation || { lat: 12.9716, lng: 77.5946 }
            )
          )
        },
        timeline: [
          ...booking.timeline,
          { label: `Server assigned ${bestCaretaker.name}`, at: Date.now() }
        ]
      },
      "admin"
    );

    await database.ref().update({
      ...bookingIndexes(nextBooking, booking),
      [`caretakers/${bestCaretaker.uid}/activeAssignments`]:
        (bestCaretaker.activeAssignments || 0) + 1,
      [`caretakers/${bestCaretaker.uid}/status`]: "standby"
    });
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

    const nextTracking = {
      ...booking.tracking,
      etaMinutes:
        status === "en_route"
          ? Math.max(3, (booking.tracking?.etaMinutes || 8) - 2)
          : status === "arrived" || status === "in_progress" || terminalStatuses.includes(status)
            ? 0
            : booking.tracking?.etaMinutes || 8,
      routeStatus:
        status === "en_route"
          ? "tracking"
          : status === "arrived" || status === "in_progress"
            ? "arrived"
            : terminalStatuses.includes(status)
              ? "completed"
              : booking.tracking?.routeStatus || "pending",
      lastLocationAt: Date.now()
    } as CareBooking["tracking"];
    const nextBooking = enrichBooking(
      {
        ...booking,
        status,
        tracking: nextTracking,
        timeline: [...booking.timeline, { label: stepLabels[status], at: Date.now() }]
      },
      "admin"
    );

    const updates = bookingIndexes(nextBooking, booking);
    if (status === "in_progress" && nextBooking.caretakerId) {
      updates[`caretakers/${nextBooking.caretakerId}/status`] = "on_visit";
    }
    if (terminalStatuses.includes(status) && nextBooking.caretakerId) {
      updates[`caretakers/${nextBooking.caretakerId}/status`] = "available";
      updates[`caretakers/${nextBooking.caretakerId}/activeAssignments`] = Math.max(
        0,
        ((await database.ref(`caretakers/${nextBooking.caretakerId}/activeAssignments`).get()).val() ||
          1) - 1
      );
      updates[`caretakers/${nextBooking.caretakerId}/activeBookingId`] = null;
    }
    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async cancel(
    bookingId: string,
    cancellation: {
      cancelledBy: "customer" | "caretaker" | "admin" | "system";
      reason: string;
    }
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

    if (!canTransition(booking.status, "cancelled")) {
      return { ok: false as const, status: 409, error: "Booking cannot be cancelled now" };
    }

    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "cancelled",
        cancellation: {
          cancelledBy: cancellation.cancelledBy,
          reason: cancellation.reason,
          refundEligible: booking.payment?.status === "paid",
          penaltyApplies: cancellation.cancelledBy === "caretaker",
          cancelledAt: Date.now()
        },
        timeline: [
          ...booking.timeline,
          { label: `Cancelled: ${cancellation.reason}`, at: Date.now() }
        ]
      },
      cancellation.cancelledBy
    );

    const updates = bookingIndexes(nextBooking, booking);
    if (booking.caretakerId) {
      updates[`caretakers/${booking.caretakerId}/status`] = "available";
      updates[`caretakers/${booking.caretakerId}/activeBookingId`] = null;
    }
    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async rate(bookingId: string, rating: { score: number; note: string; ratedBy: string }) {
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
        rating: {
          score: Math.min(5, Math.max(1, rating.score)),
          note: rating.note,
          ratedBy: rating.ratedBy,
          ratedAt: Date.now()
        },
        timeline: [
          ...booking.timeline,
          { label: `Family rated visit ${rating.score}/5`, at: Date.now() }
        ]
      },
      "customer"
    );

    await database.ref().update(bookingIndexes(nextBooking, booking));
    return { ok: true as const, booking: nextBooking };
  },

  async updateCaretakerAvailability(
    caretakerId: string,
    availability: {
      available: boolean;
      status: "available" | "standby" | "offline" | "on_visit";
      shiftEndsAt?: number;
    }
  ) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    await database.ref(`caretakers/${caretakerId}`).update({
      available: availability.available,
      status: availability.status,
      shiftEndsAt: availability.shiftEndsAt || null,
      lastSeenAt: Date.now()
    });
    return { ok: true as const };
  },

  async updateCaretakerLocation(
    caretakerId: string,
    location: CareLocation,
    bookingId?: string
  ) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const safeLocation = {
      lat: location.lat,
      lng: location.lng,
      accuracyMeters: location.accuracyMeters || 0,
      capturedAt: Date.now()
    };
    const updates: Record<string, unknown> = {
      [`caretakers/${caretakerId}/currentLocation`]: safeLocation,
      [`caretakers/${caretakerId}/lastSeenAt`]: Date.now()
    };

    if (bookingId) {
      const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
      const booking = bookingSnapshot.val() as CareBooking | null;
      if (booking?.tracking) {
        const distance = distanceKm(safeLocation, booking.tracking.customerLocation);
        const eta = etaFromDistance(distance);
        const status = distance <= 0.15 && booking.status === "en_route" ? "arrived" : booking.status;
        const nextBooking = enrichBooking(
          {
            ...booking,
            status,
            tracking: {
              ...booking.tracking,
              caretakerLocation: safeLocation,
              distanceKm: distance,
              etaMinutes: status === "arrived" ? 0 : eta,
              lastLocationAt: Date.now(),
              routeStatus: status === "arrived" ? "arrived" : "tracking"
            },
            timeline: [
              ...booking.timeline,
              {
                label: status === "arrived" ? "Caretaker arrived" : "Caretaker location updated",
                at: Date.now()
              }
            ]
          },
          "caretaker"
        );
        Object.assign(updates, bookingIndexes(nextBooking, booking));
      }
    }

    await database.ref().update(updates);
    return { ok: true as const };
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
