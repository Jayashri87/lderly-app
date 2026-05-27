import type {
  BookingPayment,
  BookingStatus,
  CareBooking,
  CareLocation,
  CaretakerMatchProfile,
  DispatchOffer
} from "../services/bookingService";
import type { UserRole } from "../services/authService";
import { getAdminDatabase } from "./firebaseAdmin";
import { computeRouteEta, enrichBookingLocation } from "./locationProvider";

type BookingActor = {
  role: UserRole;
  uid?: string;
  username?: string;
};

const transitionMap: Record<BookingStatus, BookingStatus[]> = {
  none: ["requested", "searching"],
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

const serviceOtpFor = () => String(Math.floor(100000 + Math.random() * 900000));

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

const availableCaretakersFor = (
  caretakers: CaretakerMatchProfile[],
  excludedCaretakerId = ""
) =>
  caretakers.filter(
    (caretaker) =>
      caretaker.uid !== excludedCaretakerId &&
      caretaker.available &&
      caretaker.status !== "offline" &&
      caretaker.status !== "on_visit" &&
      caretaker.activeAssignments < caretaker.maxAssignments
  );

const bestCaretakerFor = (
  booking: CareBooking,
  caretakers: CaretakerMatchProfile[],
  excludedCaretakerId = ""
) =>
  availableCaretakersFor(caretakers, excludedCaretakerId).sort(
    (a, b) => scoreCaretaker(booking, b) - scoreCaretaker(booking, a)
  )[0] || null;

const dispatchCandidatesFor = (
  booking: CareBooking,
  caretakers: CaretakerMatchProfile[],
  excludedCaretakerId = ""
) => {
  const scored = availableCaretakersFor(caretakers, excludedCaretakerId)
    .map((caretaker) => {
      const caretakerLocation =
        caretaker.currentLocation || booking.tracking?.caretakerLocation || { lat: 12.985, lng: 77.61 };
      const customerLocation = booking.tracking?.customerLocation || { lat: 12.9716, lng: 77.5946 };
      const distance = distanceKm(caretakerLocation, customerLocation);

      return {
        caretaker,
        score: scoreCaretaker(booking, caretaker) - distance,
        distanceKm: distance,
        etaMinutes: etaFromDistance(distance)
      };
    })
    .sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, 5);
  const demoCandidate = scored.find((candidate) => candidate.caretaker.uid === "demo-caretaker");

  if (demoCandidate && !selected.some((candidate) => candidate.caretaker.uid === "demo-caretaker")) {
    selected[selected.length ? selected.length - 1 : 0] = demoCandidate;
  }

  return selected;
};

const canAccessBooking = (
  booking: CareBooking,
  actor: BookingActor | undefined,
  action: "cancel" | "rate" | "status"
) => {
  if (!actor || actor.role === "admin") {
    return true;
  }

  if (actor.role === "customer") {
    return booking.customerId === actor.uid && ["cancel", "rate"].includes(action);
  }

  if (actor.role === "caretaker") {
    return booking.caretakerId === actor.uid && ["cancel", "status"].includes(action);
  }

  return false;
};

const defaultCaretakers: CaretakerMatchProfile[] = [
  {
    uid: "demo-caretaker",
    name: "Anita",
    available: true,
    city: "Bengaluru",
    zone: "Central",
    serviceZones: ["Central", "Medical", "Diagnostics"],
    skills: [
      "doctor_visit",
      "lab_support",
      "hospital_attender",
      "medicine_help",
      "companionship",
      "daily_support"
    ],
    languages: ["English", "Hindi", "Kannada"],
    rating: 4.9,
    activeAssignments: 0,
    maxAssignments: 3,
    verified: true,
    trained: true,
    yearsExperience: 6,
    status: "available",
    punctualityScore: 96,
    repeatVisits: 12,
    familiarFamilies: ["demo-customer"],
    currentLocation: { lat: 12.985, lng: 77.61, accuracyMeters: 25, capturedAt: Date.now() },
    lastSeenAt: Date.now()
  },
  {
    uid: "caretaker-kavya",
    name: "Kavya",
    available: true,
    city: "Bengaluru",
    zone: "Diagnostics",
    serviceZones: ["Diagnostics", "Central"],
    skills: ["lab_support", "doctor_visit", "daily_support", "companionship"],
    languages: ["English", "Kannada", "Telugu"],
    rating: 4.9,
    activeAssignments: 0,
    maxAssignments: 3,
    verified: true,
    trained: true,
    yearsExperience: 5,
    status: "available",
    punctualityScore: 97,
    repeatVisits: 10,
    familiarFamilies: [],
    currentLocation: { lat: 12.981, lng: 77.604, accuracyMeters: 25, capturedAt: Date.now() },
    lastSeenAt: Date.now()
  }
];

const caretakerDefaultsById = () =>
  Object.fromEntries(defaultCaretakers.map((caretaker) => [caretaker.uid, caretaker]));

const readCaretakersForDispatch = async (
  database: NonNullable<ReturnType<typeof getAdminDatabase>>
) => {
  const caretakerSnapshot = await database.ref("caretakers").get();
  const records = caretakerSnapshot.val() as Record<string, CaretakerMatchProfile> | null;
  const merged = {
    ...(records || {})
  };
  let changed = false;

  for (const caretaker of defaultCaretakers) {
    merged[caretaker.uid] = {
      ...merged[caretaker.uid],
      ...caretaker
    };
    changed = true;
  }

  if (!availableCaretakersFor(Object.values(merged)).length) {
    Object.assign(merged, caretakerDefaultsById());
    changed = true;
  }

  if (changed) {
    await database.ref("caretakers").update(
      Object.fromEntries(
        defaultCaretakers.map((caretaker) => [
          caretaker.uid,
          {
            ...merged[caretaker.uid],
            ...caretaker
          }
        ])
      )
    );
  }

  return Object.values(merged);
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

    const existingByIdSnapshot = await database.ref(`bookings/byId/${booking.id}`).get();
    const existingById = existingByIdSnapshot.val() as CareBooking | null;

    if (existingById) {
      return { ok: true as const, booking: existingById };
    }

    const locationReadyBooking = await enrichBookingLocation({
      ...booking,
      status: booking.status === "requested" ? "searching" : booking.status
    });
    const caretakers = await readCaretakersForDispatch(database);
    const candidates = dispatchCandidatesFor(locationReadyBooking, caretakers);
    const timestamp = Date.now();
    const offers: Record<string, DispatchOffer> = Object.fromEntries(
      candidates.map(({ caretaker, score, distanceKm: distance, etaMinutes }) => [
        caretaker.uid,
        {
          bookingId: locationReadyBooking.id,
          caretakerId: caretaker.uid,
          caretakerName: caretaker.name,
          score: Number(score.toFixed(2)),
          distanceKm: distance,
          etaMinutes,
          status: "sent" as const,
          notifiedAt: timestamp
        }
      ])
    );
    const safeBooking = enrichBooking(
      {
        ...locationReadyBooking,
        caretakerId: "",
        caretakerName: "Nearby caregivers notified",
        dispatch: {
          mode: "area_broadcast",
          status: candidates.length ? "broadcasting" : "manual_review",
          offerExpiresAt: timestamp + 90 * 1000,
          candidateCount: candidates.length,
          offers
        },
        serviceStart: {
          otp: serviceOtpFor(),
          sharedWithCustomerAt: timestamp
        },
        completion: {
          paymentReleaseStatus: "not_ready"
        },
        timeline: [
          ...locationReadyBooking.timeline,
          {
            label: candidates.length
              ? `Request sent to ${candidates.length} nearby caregivers`
              : "No nearby caregivers available - ops review needed",
            at: timestamp
          }
        ]
      },
      "system"
    );
    const updates = bookingIndexes(safeBooking);
    candidates.forEach(({ caretaker, distanceKm: distance, etaMinutes }) => {
      updates[`caretakers/${caretaker.uid}/offers/${safeBooking.id}`] = {
        bookingId: safeBooking.id,
        serviceType: safeBooking.serviceType,
        customerName: safeBooking.customerName,
        destinationLabel: safeBooking.tracking?.destinationLabel || "Care location",
        distanceKm: distance,
        etaMinutes,
        status: "sent",
        notifiedAt: timestamp,
        expiresAt: timestamp + 90 * 1000
      };
      updates[`caretakers/${caretaker.uid}/activeBookingId`] = safeBooking.id;
      updates[`operations/dispatchOffers/${safeBooking.id}/${caretaker.uid}`] =
        safeBooking.dispatch?.offers?.[caretaker.uid];
    });
    await database.ref().update(updates);
    return { ok: true as const, booking: safeBooking };
  },

  async acceptOffer(bookingId: string, actor?: BookingActor) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    if (!actor?.uid || actor.role !== "caretaker") {
      return { ok: false as const, status: 403, error: "Caretaker session required" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (!["searching", "assigned"].includes(booking.status)) {
      return { ok: false as const, status: 409, error: "Booking is no longer open" };
    }

    const offer = booking.dispatch?.offers?.[actor.uid];

    if (booking.dispatch?.mode === "area_broadcast" && !offer) {
      return { ok: false as const, status: 403, error: "No dispatch offer for caretaker" };
    }

    const timestamp = Date.now();

    if (
      booking.dispatch?.mode === "area_broadcast" &&
      (offer?.status !== "sent" || timestamp > booking.dispatch.offerExpiresAt)
    ) {
      await database.ref().update({
        [`bookings/byId/${booking.id}/dispatch/status`]: "expired",
        [`bookings/byId/${booking.id}/dispatch/offers/${actor.uid}/status`]: "expired",
        [`bookings/byId/${booking.id}/sla/status`]: "breached",
        [`bookings/byId/${booking.id}/sla/breachReason`]:
          "Caregiver offer expired before acceptance",
        [`caretakers/${actor.uid}/offers/${booking.id}/status`]: "expired",
        [`caretakers/${actor.uid}/activeBookingId`]: null,
        [`operations/dispatchOffers/${booking.id}/${actor.uid}/status`]: "expired"
      });
      return { ok: false as const, status: 409, error: "Dispatch offer expired" };
    }

    const caretakerSnapshot = await database.ref(`caretakers/${actor.uid}`).get();
    const caretaker = caretakerSnapshot.val() as CaretakerMatchProfile | null;

    if (!caretaker || caretaker.status === "offline" || caretaker.status === "on_visit") {
      return { ok: false as const, status: 409, error: "Caretaker is unavailable" };
    }

    if (caretaker.activeBookingId && caretaker.activeBookingId !== booking.id) {
      return { ok: false as const, status: 409, error: "Caretaker already has an active request" };
    }

    const nextOffers: Record<string, DispatchOffer> = Object.fromEntries(
      Object.entries(booking.dispatch?.offers || {}).map(([caretakerId, dispatchOffer]) => [
        caretakerId,
        {
          ...dispatchOffer,
          status: caretakerId === actor.uid ? "accepted" as const : "expired" as const,
          respondedAt: timestamp
        }
      ])
    );
    const caretakerLocation =
      caretaker.currentLocation || booking.tracking?.caretakerLocation || { lat: 12.985, lng: 77.61 };
    const customerLocation = booking.tracking?.customerLocation || { lat: 12.9716, lng: 77.5946 };
    const distance = distanceKm(caretakerLocation, customerLocation);
    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "accepted",
        caretakerId: caretaker.uid,
        caretakerName: caretaker.name,
        dispatch: {
          ...(booking.dispatch || {
            mode: "area_broadcast" as const,
            offerExpiresAt: timestamp,
            candidateCount: 1
          }),
          status: "accepted",
          acceptedBy: caretaker.uid,
          acceptedAt: timestamp,
          offers: nextOffers
        },
        matching: {
          ...booking.matching,
          preferredCaretakerId: caretaker.uid
        },
        tracking: {
          ...(booking.tracking || {
            customerLocation,
            caretakerLocation,
            destinationLabel: "Care location",
            distanceKm: distance,
            etaMinutes: etaFromDistance(distance),
            lastLocationAt: timestamp,
            routeStatus: "pending" as const
          }),
          caretakerLocation,
          distanceKm: distance,
          etaMinutes: etaFromDistance(distance),
          lastLocationAt: timestamp,
          routeStatus: "pending"
        },
        timeline: [
          ...booking.timeline,
          { label: `${caretaker.name} accepted the care request`, at: timestamp }
        ]
      },
      "caretaker"
    );
    const updates = bookingIndexes(nextBooking, booking);
    updates[`caretakers/${caretaker.uid}/activeAssignments`] =
      (caretaker.activeAssignments || 0) + 1;
    updates[`caretakers/${caretaker.uid}/status`] = "standby";
    Object.keys(booking.dispatch?.offers || {}).forEach((caretakerId) => {
      updates[`caretakers/${caretakerId}/offers/${booking.id}/status`] =
        caretakerId === actor.uid ? "accepted" : "expired";
      updates[`operations/dispatchOffers/${booking.id}/${caretakerId}/status`] =
        caretakerId === actor.uid ? "accepted" : "expired";
      if (caretakerId !== actor.uid) {
        updates[`caretakers/${caretakerId}/activeBookingId`] = null;
      }
    });

    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async rejectOffer(bookingId: string, actor?: BookingActor, reason = "Caregiver rejected request") {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    if (!actor?.uid || actor.role !== "caretaker") {
      return { ok: false as const, status: 403, error: "Caretaker session required" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    const offer = booking.dispatch?.offers?.[actor.uid];

    if (!offer) {
      return { ok: false as const, status: 403, error: "No dispatch offer for caretaker" };
    }

    if (offer.status !== "sent") {
      return { ok: false as const, status: 409, error: "Offer is no longer open" };
    }

    const timestamp = Date.now();
    const remainingOpenOffers = Object.entries(booking.dispatch?.offers || {}).filter(
      ([caretakerId, dispatchOffer]) =>
        caretakerId !== actor.uid && dispatchOffer.status === "sent"
    ).length;
    const nextStatus = remainingOpenOffers > 0 ? booking.status : "searching";
    const nextBooking = enrichBooking(
      {
        ...booking,
        status: nextStatus,
        caretakerId: booking.caretakerId === actor.uid ? "" : booking.caretakerId,
        caretakerName:
          booking.caretakerId === actor.uid
            ? "Nearby caregivers notified"
            : booking.caretakerName,
        dispatch: {
          ...(booking.dispatch || {
            mode: "area_broadcast" as const,
            status: "broadcasting" as const,
            offerExpiresAt: timestamp,
            candidateCount: 1
          }),
          status: remainingOpenOffers > 0 ? "broadcasting" : "manual_review",
          offers: {
            ...(booking.dispatch?.offers || {}),
            [actor.uid]: {
              ...offer,
              status: "rejected",
              respondedAt: timestamp
            }
          }
        },
        timeline: [
          ...booking.timeline,
          { label: `Caregiver declined request: ${reason}`, at: timestamp }
        ]
      },
      "caretaker"
    );

    const updates = bookingIndexes(nextBooking, booking);
    updates[`caretakers/${actor.uid}/offers/${booking.id}/status`] = "rejected";
    updates[`caretakers/${actor.uid}/offers/${booking.id}/respondedAt`] = timestamp;
    updates[`caretakers/${actor.uid}/activeBookingId`] = null;
    updates[`operations/dispatchOffers/${booking.id}/${actor.uid}/status`] = "rejected";
    updates[`operations/dispatchOffers/${booking.id}/${actor.uid}/respondedAt`] = timestamp;

    if (!remainingOpenOffers) {
      updates[`operations/reassignmentQueue/pending/${booking.id}`] = {
        bookingId: booking.id,
        reason: "All nearby caregivers rejected or expired",
        createdAt: timestamp
      };
    }

    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async rebroadcast(bookingId: string, reason = "Ops rebroadcast") {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (
      ["in_progress", "completed", "payment_settled", "report_generated", "cancelled", "none"].includes(
        booking.status
      )
    ) {
      return { ok: false as const, status: 409, error: "Booking cannot be rebroadcast" };
    }

    const caretakers = await readCaretakersForDispatch(database);
    const previousCaretakerId = booking.caretakerId;
    const candidates = dispatchCandidatesFor(
      {
        ...booking,
        caretakerId: "",
        caretakerName: "Nearby caregivers notified",
        status: "searching"
      },
      caretakers,
      previousCaretakerId
    );
    const timestamp = Date.now();
    const offers: Record<string, DispatchOffer> = Object.fromEntries(
      candidates.map(({ caretaker, score, distanceKm: distance, etaMinutes }) => [
        caretaker.uid,
        {
          bookingId: booking.id,
          caretakerId: caretaker.uid,
          caretakerName: caretaker.name,
          score: Number(score.toFixed(2)),
          distanceKm: distance,
          etaMinutes,
          status: "sent" as const,
          notifiedAt: timestamp
        }
      ])
    );
    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "searching",
        caretakerId: "",
        caretakerName: "Nearby caregivers notified",
        dispatch: {
          mode: "area_broadcast",
          status: candidates.length ? "broadcasting" : "manual_review",
          offerExpiresAt: timestamp + 90 * 1000,
          candidateCount: candidates.length,
          offers
        },
        sla: {
          ...(booking.sla || {
            assignmentDueAt: timestamp + 10 * 60 * 1000,
            arrivalDueAt: booking.scheduledFor + 20 * 60 * 1000,
            status: "healthy" as const,
            breachReason: ""
          }),
          assignmentDueAt: timestamp + 6 * 60 * 1000,
          status: candidates.length ? "watch" as const : "breached" as const,
          breachReason: reason
        },
        timeline: [
          ...booking.timeline,
          {
            label: candidates.length
              ? `${reason}: request resent to ${candidates.length} caregivers`
              : `${reason}: no backup caregivers available`,
            at: timestamp
          }
        ]
      },
      "system"
    );
    const updates = bookingIndexes(nextBooking, booking);
    const nextCaretakerIds = new Set(candidates.map(({ caretaker }) => caretaker.uid));
    Object.keys(booking.dispatch?.offers || {}).forEach((caretakerId) => {
      if (nextCaretakerIds.has(caretakerId)) {
        return;
      }
      updates[`caretakers/${caretakerId}/offers/${booking.id}/status`] = "expired";
      updates[`caretakers/${caretakerId}/activeBookingId`] = null;
      updates[`operations/dispatchOffers/${booking.id}/${caretakerId}/status`] = "expired";
    });
    candidates.forEach(({ caretaker, distanceKm: distance, etaMinutes }) => {
      updates[`caretakers/${caretaker.uid}/offers/${booking.id}`] = {
        bookingId: booking.id,
        serviceType: booking.serviceType,
        customerName: booking.customerName,
        destinationLabel: booking.tracking?.destinationLabel || "Care location",
        distanceKm: distance,
        etaMinutes,
        status: "sent",
        notifiedAt: timestamp,
        expiresAt: timestamp + 90 * 1000
      };
      updates[`caretakers/${caretaker.uid}/activeBookingId`] = booking.id;
      updates[`operations/dispatchOffers/${booking.id}/${caretaker.uid}`] =
        nextBooking.dispatch?.offers?.[caretaker.uid];
    });
    if (previousCaretakerId) {
      updates[`caretakers/${previousCaretakerId}/activeBookingId`] = null;
      updates[`caretakers/${previousCaretakerId}/status`] = "available";
      updates[`caretakers/${previousCaretakerId}/offers/${booking.id}/status`] = "cancelled";
      updates[`operations/dispatchOffers/${booking.id}/${previousCaretakerId}/status`] = "cancelled";
      const previousAssignments =
        ((await database.ref(`caretakers/${previousCaretakerId}/activeAssignments`).get()).val() ||
          1) as number;
      updates[`caretakers/${previousCaretakerId}/activeAssignments`] = Math.max(
        0,
        previousAssignments - 1
      );
    }

    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
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

    const caretakers = await readCaretakersForDispatch(database);
    const bestCaretaker = bestCaretakerFor(booking, caretakers);

    if (!bestCaretaker) {
      return { ok: false as const, status: 409, error: "No available caretaker" };
    }

    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "assigned",
        caretakerId: bestCaretaker.uid,
        caretakerName: bestCaretaker.name,
        dispatch: booking.dispatch
          ? {
              ...booking.dispatch,
              status: "accepted",
              acceptedBy: bestCaretaker.uid,
              acceptedAt: Date.now()
            }
          : {
              mode: "manual_assignment",
              status: "accepted",
              offerExpiresAt: Date.now(),
              candidateCount: 1,
              acceptedBy: bestCaretaker.uid,
              acceptedAt: Date.now()
            },
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

    const updates: Record<string, unknown> = {
      ...bookingIndexes(nextBooking, booking),
      [`caretakers/${bestCaretaker.uid}/activeAssignments`]:
        (bestCaretaker.activeAssignments || 0) + 1,
      [`caretakers/${bestCaretaker.uid}/status`]: "standby"
    };
    Object.keys(booking.dispatch?.offers || {}).forEach((caretakerId) => {
      updates[`caretakers/${caretakerId}/offers/${booking.id}/status`] =
        caretakerId === bestCaretaker.uid ? "accepted" : "expired";
      updates[`operations/dispatchOffers/${booking.id}/${caretakerId}/status`] =
        caretakerId === bestCaretaker.uid ? "accepted" : "expired";
      if (caretakerId !== bestCaretaker.uid) {
        updates[`caretakers/${caretakerId}/activeBookingId`] = null;
      }
    });

    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async reassign(bookingId: string) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (
      ["completed", "payment_settled", "report_generated", "cancelled", "none"].includes(
        booking.status
      )
    ) {
      return { ok: false as const, status: 409, error: "Booking cannot be reassigned" };
    }

    const caretakers = await readCaretakersForDispatch(database);
    const bestCaretaker = bestCaretakerFor(booking, caretakers, booking.caretakerId);

    if (!bestCaretaker) {
      return { ok: false as const, status: 409, error: "No backup caretaker available" };
    }

    const previousCaretakerId = booking.caretakerId;
    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "assigned",
        caretakerId: bestCaretaker.uid,
        caretakerName: bestCaretaker.name,
        matching: {
          ...booking.matching,
          preferredCaretakerId: bestCaretaker.uid
        },
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
          caretakerLocation:
            bestCaretaker.currentLocation ||
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
          { label: `Ops reassigned ${bestCaretaker.name} as backup caregiver`, at: Date.now() }
        ],
        sla: {
          ...(booking.sla || {
            assignmentDueAt: booking.createdAt + 10 * 60 * 1000,
            arrivalDueAt: booking.scheduledFor + 20 * 60 * 1000,
            status: "healthy" as const,
            breachReason: ""
          }),
          status: "watch" as const,
          breachReason: "Reassignment completed after ops review"
        }
      },
      "admin"
    );
    const updates: Record<string, unknown> = {
      ...bookingIndexes(nextBooking, booking),
      [`caretakers/${bestCaretaker.uid}/activeAssignments`]:
        (bestCaretaker.activeAssignments || 0) + 1,
      [`caretakers/${bestCaretaker.uid}/status`]: "standby",
      [`operations/reassignmentQueue/completed/${booking.id}`]: {
        bookingId: booking.id,
        previousCaretakerId,
        nextCaretakerId: bestCaretaker.uid,
        reason: booking.sla?.breachReason || "Ops backup reassignment",
        createdAt: Date.now()
      }
    };

    if (previousCaretakerId) {
      const previousAssignments =
        ((await database.ref(`caretakers/${previousCaretakerId}/activeAssignments`).get()).val() ||
          1) as number;

      updates[`caretakers/${previousCaretakerId}/activeAssignments`] = Math.max(
        0,
        previousAssignments - 1
      );
      updates[`caretakers/${previousCaretakerId}/activeBookingId`] = null;
      updates[`caretakers/${previousCaretakerId}/status`] = "available";
    }

    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async updateStatus(bookingId: string, status: BookingStatus, actor?: BookingActor) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (!canAccessBooking(booking, actor, "status")) {
      return { ok: false as const, status: 403, error: "Forbidden" };
    }

    if (!canTransition(booking.status, status)) {
      return { ok: false as const, status: 409, error: "Invalid booking transition" };
    }

    if (
      status === "in_progress" &&
      actor?.role === "caretaker" &&
      !booking.serviceStart?.verifiedAt
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Customer OTP verification is required before starting service"
      };
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
    const completion =
      status === "completed" && actor?.role === "caretaker"
        ? {
            ...(booking.completion || { paymentReleaseStatus: "not_ready" as const }),
            caretakerMarkedDoneAt: Date.now(),
            paymentReleaseStatus: "awaiting_customer" as const
          }
        : booking.completion;
    const nextBooking = enrichBooking(
      {
        ...booking,
        status,
        tracking: nextTracking,
        completion,
        timeline: [...booking.timeline, { label: stepLabels[status], at: Date.now() }]
      },
      actor?.role || "admin"
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

  async startWithOtp(bookingId: string, otp: string, actor?: BookingActor) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (!canAccessBooking(booking, actor, "status")) {
      return { ok: false as const, status: 403, error: "Forbidden" };
    }

    if (booking.status !== "arrived") {
      return { ok: false as const, status: 409, error: "Caregiver must arrive before start" };
    }

    if (!booking.serviceStart?.otp || booking.serviceStart.otp !== otp.trim()) {
      return { ok: false as const, status: 400, error: "Invalid customer OTP" };
    }

    const timestamp = Date.now();
    const nextBooking = enrichBooking(
      {
        ...booking,
        status: "in_progress",
        serviceStart: {
          ...booking.serviceStart,
          verifiedAt: timestamp,
          verifiedBy: actor?.uid || actor?.username || "caretaker"
        },
        completion: {
          ...(booking.completion || { paymentReleaseStatus: "not_ready" as const }),
          paymentReleaseStatus: "not_ready"
        },
        timeline: [
          ...booking.timeline,
          { label: "Customer OTP verified - service started", at: timestamp }
        ]
      },
      "caretaker"
    );
    const updates = bookingIndexes(nextBooking, booking);
    if (nextBooking.caretakerId) {
      updates[`caretakers/${nextBooking.caretakerId}/status`] = "on_visit";
    }
    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async verifyCompletion(
    bookingId: string,
    verification: { approved: boolean; note?: string },
    actor?: BookingActor
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

    if (actor?.role !== "admin" && (actor?.role !== "customer" || actor.uid !== booking.customerId)) {
      return { ok: false as const, status: 403, error: "Forbidden" };
    }

    if (booking.status !== "completed") {
      return { ok: false as const, status: 409, error: "Booking is not awaiting completion verification" };
    }

    const timestamp = Date.now();
    const nextStatus: BookingStatus = verification.approved ? "payment_settled" : "completed";
    const nextBooking = enrichBooking(
      {
        ...booking,
        status: nextStatus,
        completion: {
          ...(booking.completion || { paymentReleaseStatus: "awaiting_customer" as const }),
          customerVerifiedAt: verification.approved ? timestamp : undefined,
          verifiedBy: verification.approved ? actor?.uid || actor?.username || "customer" : undefined,
          paymentReleaseStatus: verification.approved ? "released" : "awaiting_customer"
        },
        timeline: [
          ...booking.timeline,
          {
            label: verification.approved
              ? "Family verified completion - payment released"
              : `Family requested review${verification.note ? `: ${verification.note}` : ""}`,
            at: timestamp
          }
        ]
      },
      actor?.role || "customer"
    );
    const updates = bookingIndexes(nextBooking, booking);
    if (nextBooking.caretakerId && verification.approved) {
      updates[`payouts/releaseQueue/${booking.id}`] = {
        bookingId: booking.id,
        caretakerId: nextBooking.caretakerId,
        customerId: booking.customerId,
        status: "ready_for_payout",
        releasedAt: timestamp
      };
    }
    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async nudgeCompletionVerification(bookingId: string) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
    const booking = bookingSnapshot.val() as CareBooking | null;

    if (!booking) {
      return { ok: false as const, status: 404, error: "Booking not found" };
    }

    if (booking.status !== "completed" || booking.completion?.paymentReleaseStatus !== "awaiting_customer") {
      return { ok: false as const, status: 409, error: "Booking is not awaiting customer verification" };
    }

    const timestamp = Date.now();
    const nextBooking = enrichBooking(
      {
        ...booking,
        timeline: [
          ...booking.timeline,
          { label: "Family reminded to verify completion and release payment", at: timestamp }
        ]
      },
      "system"
    );

    await database.ref().update({
      ...bookingIndexes(nextBooking, booking),
      [`notifications/byUser/${booking.customerId}/completion-${booking.id}`]: {
        id: `completion-${booking.id}`,
        userId: booking.customerId,
        role: "customer",
        title: "Please verify today's care",
        body: "Your caregiver marked the visit complete. Please verify so payment can be released.",
        priority: "urgent",
        channel: "in_app",
        deliveryStatus: "queued",
        read: false,
        createdAt: timestamp
      }
    });
    return { ok: true as const, booking: nextBooking };
  },

  async cancel(
    bookingId: string,
    cancellation: {
      cancelledBy: "customer" | "caretaker" | "admin" | "system";
      reason: string;
    },
    actor?: BookingActor
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

    if (!canAccessBooking(booking, actor, "cancel")) {
      return { ok: false as const, status: 403, error: "Forbidden" };
    }

    if (actor?.role === "caretaker" && ["accepted", "en_route", "arrived"].includes(booking.status)) {
      return this.rebroadcast(
        bookingId,
        `Caregiver cancelled after accepting: ${cancellation.reason}`
      );
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
    Object.keys(booking.dispatch?.offers || {}).forEach((caretakerId) => {
      updates[`caretakers/${caretakerId}/offers/${booking.id}/status`] = "cancelled";
      updates[`operations/dispatchOffers/${booking.id}/${caretakerId}/status`] = "cancelled";
      if (!booking.caretakerId || caretakerId !== booking.caretakerId) {
        updates[`caretakers/${caretakerId}/activeBookingId`] = null;
      }
    });
    await database.ref().update(updates);
    return { ok: true as const, booking: nextBooking };
  },

  async rate(
    bookingId: string,
    rating: { score: number; note: string; ratedBy: string },
    actor?: BookingActor
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

    if (!canAccessBooking(booking, actor, "rate")) {
      return { ok: false as const, status: 403, error: "Forbidden" };
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

    const updates = bookingIndexes(nextBooking, booking);

    if (booking.caretakerId) {
      const caretakerSnapshot = await database.ref(`caretakers/${booking.caretakerId}`).get();
      const caretaker = caretakerSnapshot.val() as CaretakerMatchProfile | null;
      const previousRating = caretaker?.rating || rating.score;
      const previousRepeats = caretaker?.repeatVisits || 0;
      const nextRepeats = previousRepeats + 1;
      const nextRating = Number(
        ((previousRating * Math.max(1, previousRepeats) + rating.score) /
          Math.max(2, previousRepeats + 1)).toFixed(2)
      );

      updates[`caretakers/${booking.caretakerId}/rating`] = nextRating;
      updates[`caretakers/${booking.caretakerId}/repeatVisits`] = nextRepeats;
      updates[`caretakers/${booking.caretakerId}/lastRatedAt`] = Date.now();
      updates[`trustLedger/caregivers/${booking.caretakerId}/${booking.id}`] = {
        bookingId: booking.id,
        customerId: booking.customerId,
        serviceType: booking.serviceType,
        score: Math.min(5, Math.max(1, rating.score)),
        note: rating.note,
        ratedBy: rating.ratedBy,
        ratedAt: Date.now()
      };
    }

    await database.ref().update(updates);
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
      capturedAt: location.capturedAt || Date.now()
    };
    const updates: Record<string, unknown> = {
      [`caretakers/${caretakerId}/currentLocation`]: safeLocation,
      [`caretakers/${caretakerId}/lastSeenAt`]: Date.now()
    };

    if (bookingId) {
      const bookingSnapshot = await database.ref(`bookings/byId/${bookingId}`).get();
      const booking = bookingSnapshot.val() as CareBooking | null;
      if (booking?.tracking) {
        const routeEta = await computeRouteEta(safeLocation, booking.tracking.customerLocation);
        const distance = routeEta.distanceKm;
        const eta = routeEta.etaMinutes;
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
              routeStatus: status === "arrived" ? "arrived" : "tracking",
              routePolyline: routeEta.encodedPolyline || booking.tracking.routePolyline,
              routeDistanceMeters: routeEta.distanceMeters,
              routeDurationSeconds: routeEta.durationSeconds,
              routeSource: routeEta.source,
              routeUpdatedAt: Date.now()
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
