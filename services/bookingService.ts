import { Database } from "firebase/database";
import { get, off, onValue, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";
import { NotificationService } from "./notificationService";

export type BookingStatus =
  | "none"
  | "requested"
  | "searching"
  | "assigned"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "payment_settled"
  | "report_generated"
  | "cancelled";

export type CareBooking = {
  id: string;
  serviceType: string;
  status: BookingStatus;
  customerId: string;
  customerName: string;
  caretakerId: string;
  caretakerName: string;
  scheduledFor: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
  requestDetails?: BookingRequestDetails;
  lifecycle: BookingLifecycle;
  matching: CaregiverMatching;
  scheduleIndex: BookingScheduleIndex;
  payment: BookingPayment;
  familyUpdates: FamilyUpdateSettings;
  serviceReport: ServiceReportPlan;
  dispatch?: BookingDispatch;
  serviceStart?: ServiceStartVerification;
  completion?: CompletionVerification;
  tracking?: BookingTracking;
  sla?: BookingSla;
  cancellation?: BookingCancellation;
  rating?: BookingRating;
  timeline: Array<{
    label: string;
    at: number;
  }>;
};

export type DispatchOffer = {
  bookingId: string;
  caretakerId: string;
  caretakerName: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  status: "sent" | "accepted" | "rejected" | "expired" | "cancelled";
  notifiedAt: number;
  respondedAt?: number;
};

export type BookingDispatch = {
  mode: "area_broadcast" | "manual_assignment";
  status: "broadcasting" | "accepted" | "expired" | "manual_review";
  offerExpiresAt: number;
  candidateCount: number;
  acceptedBy?: string;
  acceptedAt?: number;
  offers?: Record<string, DispatchOffer>;
};

export type ServiceStartVerification = {
  otp: string;
  sharedWithCustomerAt: number;
  verifiedAt?: number;
  verifiedBy?: string;
};

export type CompletionVerification = {
  caretakerMarkedDoneAt?: number;
  customerVerifiedAt?: number;
  verifiedBy?: string;
  paymentReleaseStatus: "not_ready" | "awaiting_customer" | "released";
};

export type CareLocation = {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  capturedAt?: number;
};

export type BookingRequestDetails = {
  careFor: {
    relationship: string;
    displayName: string;
  };
  careNeed: string;
  service: string;
  duration: {
    label: string;
    price: string;
    note: string;
  };
  schedule: {
    label: string;
    detail: string;
    requestedFor: number;
  };
  location: {
    label: string;
    detail: string;
  };
  pricing: {
    careEstimate: string;
    coordinationFee: string;
    estimatedTotal: string;
  };
  trust: string[];
};

export type BookingLifecycle = {
  allowedNextStatuses: BookingStatus[];
  currentStep: string;
  nextStep: string;
  lastActor: SessionUser["role"] | "system";
};

export type CaregiverMatching = {
  requiredSkills: string[];
  preferredLanguages: string[];
  city: string;
  zone: string;
  priority: "normal" | "urgent" | "critical";
  preferredCaretakerId: string;
  assignmentCapacityRequired: number;
};

export type BookingScheduleIndex = {
  dateKey: string;
  hourKey: string;
  statusKey: string;
  city: string;
  zone: string;
};

export type BookingPayment = {
  estimatedTotal: string;
  careEstimate: string;
  coordinationFee: string;
  method: "pending" | "upi" | "card" | "cash";
  status: "pending" | "authorized" | "paid" | "refunded" | "failed";
  invoiceId: string;
};

export type BookingTracking = {
  etaMinutes: number;
  distanceKm: number;
  destinationLabel: string;
  customerLocation: CareLocation;
  caretakerLocation: CareLocation;
  lastLocationAt: number;
  routeStatus: "pending" | "tracking" | "arrived" | "completed";
  routePolyline?: string;
  routePath?: CareLocation[];
  routeDistanceMeters?: number;
  routeDurationSeconds?: number;
  routeSource?: "google-routes" | "distance-fallback";
  routeUpdatedAt?: number;
};

export type BookingSla = {
  assignmentDueAt: number;
  arrivalDueAt: number;
  status: "healthy" | "watch" | "breached";
  breachReason: string;
};

export type BookingCancellation = {
  cancelledBy: "customer" | "caretaker" | "admin" | "system";
  reason: string;
  refundEligible: boolean;
  penaltyApplies: boolean;
  cancelledAt: number;
};

export type BookingRating = {
  score: number;
  note: string;
  ratedBy: string;
  ratedAt: number;
};

export type FamilyUpdateSettings = {
  inApp: "queued" | "sent" | "failed";
  whatsapp: "pending" | "queued" | "sent" | "failed";
  sms: "pending" | "queued" | "sent" | "failed";
  voiceNote: "not_requested" | "pending" | "uploaded";
  recipients: string[];
};

export type ServiceReportPlan = {
  reportType:
    | "doctor_visit"
    | "lab_support"
    | "hospital_attender"
    | "medicine_help"
    | "companionship"
    | "daily_support"
    | "general_care";
  requiredSections: string[];
  uploadSlots: string[];
};

export type CaretakerMatchProfile = {
  uid: string;
  name: string;
  available: boolean;
  city: string;
  zone: string;
  skills: string[];
  languages: string[];
  rating: number;
  activeAssignments: number;
  maxAssignments: number;
  verified: boolean;
  trained: boolean;
  yearsExperience: number;
  status?: "available" | "on_visit" | "standby" | "offline";
  serviceZones?: string[];
  punctualityScore?: number;
  repeatVisits?: number;
  familiarFamilies?: string[];
  currentLocation?: CareLocation;
  lastSeenAt?: number;
  activeBookingId?: string | null;
};

const storageKey = "lderly-active-booking";
const now = () => Date.now();
const demoCaretakerProfile: CaretakerMatchProfile = {
  uid: "demo-caretaker",
  name: "Anita",
  available: true,
  city: "Bengaluru",
  zone: "Central",
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
  yearsExperience: 6
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

const defaultCustomerLocation: CareLocation = {
  lat: 12.9716,
  lng: 77.5946
};

const defaultCaretakerLocation: CareLocation = {
  lat: 12.985,
  lng: 77.61
};

const createDefaultBooking = (): CareBooking => ({
  id: "demo-booking",
  serviceType: "No booking",
  status: "none",
  customerId: "",
  customerName: "Family",
  caretakerId: "",
  caretakerName: "Awaiting",
  scheduledFor: now() + 60 * 60 * 1000,
  notes: "No active booking",
  createdAt: now(),
  updatedAt: now(),
  lifecycle: {
    allowedNextStatuses: transitionMap.none,
    currentStep: stepLabels.none,
    nextStep: stepLabels.requested,
    lastActor: "system"
  },
  matching: {
    requiredSkills: [],
    preferredLanguages: [],
    city: "Bengaluru",
    zone: "Central",
    priority: "normal",
    preferredCaretakerId: "",
    assignmentCapacityRequired: 1
  },
  scheduleIndex: {
    dateKey: "",
    hourKey: "",
    statusKey: "none",
    city: "Bengaluru",
    zone: "Central"
  },
  payment: {
    estimatedTotal: "Rs 0",
    careEstimate: "Rs 0",
    coordinationFee: "Included",
    method: "pending",
    status: "pending",
    invoiceId: ""
  },
    familyUpdates: {
      inApp: "queued",
      whatsapp: "pending",
      sms: "pending",
      voiceNote: "not_requested",
      recipients: []
    },
    serviceReport: {
      reportType: "general_care",
      requiredSections: ["Summary"],
      uploadSlots: []
    },
    tracking: {
      etaMinutes: 0,
      distanceKm: 0,
      destinationLabel: "Care location",
      customerLocation: defaultCustomerLocation,
      caretakerLocation: defaultCaretakerLocation,
      lastLocationAt: now(),
      routeStatus: "pending"
    },
    sla: {
      assignmentDueAt: now() + 10 * 60 * 1000,
      arrivalDueAt: now() + 45 * 60 * 1000,
      status: "healthy",
      breachReason: ""
    },
    timeline: [{ label: "No active booking", at: now() }]
});

let localBooking = createDefaultBooking();
const localSubscribers = new Set<(booking: CareBooking) => void>();

const canUseStorage = () => typeof window !== "undefined";
const allowLocalFallback = () =>
  process.env.NODE_ENV !== "production" ||
  (typeof window !== "undefined" &&
    window.localStorage.getItem("lderly-enable-local-fallbacks") === "true");
const clientDatabaseWritesEnabled = () =>
  typeof window === "undefined" ||
  window.localStorage.getItem("lderly-enable-client-db-writes") === "true";
const bookingRef = (database: Database, bookingId: string) =>
  ref(database, `bookings/byId/${bookingId}`);

const readLocalBooking = () => {
  if (!canUseStorage()) {
    return localBooking;
  }

  const storedBooking = window.localStorage.getItem(storageKey);

  if (!storedBooking) {
    return localBooking;
  }

  try {
    localBooking = JSON.parse(storedBooking) as CareBooking;
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return localBooking;
};

const writeLocalBooking = (booking: CareBooking) => {
  localBooking = booking;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(booking));
  }

  localSubscribers.forEach((callback) => callback(booking));
};

const addTimeline = (booking: CareBooking, label: string): CareBooking => {
  const timestamp = now();

  return {
    ...booking,
    updatedAt: timestamp,
    timeline: [...booking.timeline, { label, at: timestamp }]
  };
};

const dateKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const hourKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 13);

const normalizeService = (serviceType: string) => serviceType.toLowerCase();

const reportPlanFor = (serviceType: string): ServiceReportPlan => {
  const service = normalizeService(serviceType);

  if (service.includes("doctor")) {
    return {
      reportType: "doctor_visit",
      requiredSections: ["Appointment details", "Doctor notes", "Prescription", "Follow-up"],
      uploadSlots: ["Prescription", "Clinic bill", "Doctor notes"]
    };
  }

  if (service.includes("lab") || service.includes("report")) {
    return {
      reportType: "lab_support",
      requiredSections: ["Lab details", "Test status", "Report collection", "Family handover"],
      uploadSlots: ["Lab receipt", "Lab report"]
    };
  }

  if (service.includes("hospital")) {
    return {
      reportType: "hospital_attender",
      requiredSections: ["Admission/support status", "Doctor round", "Meals/water", "Discharge notes"],
      uploadSlots: ["Hospital bill", "Discharge summary", "Prescription"]
    };
  }

  if (service.includes("medicine") || service.includes("recovery")) {
    return {
      reportType: "medicine_help",
      requiredSections: ["Prescription", "Medicine availability", "Pickup/delivery", "Dosage timing"],
      uploadSlots: ["Prescription", "Medicine bill", "Medicine photo"]
    };
  }

  if (
    service.includes("temple") ||
    service.includes("birthday") ||
    service.includes("festival") ||
    service.includes("occasion") ||
    service.includes("conversation") ||
    service.includes("walk")
  ) {
    return {
      reportType: "companionship",
      requiredSections: ["Visit notes", "Mood", "Mobility", "Family update"],
      uploadSlots: ["Visit photo", "Voice note"]
    };
  }

  if (service.includes("meal") || service.includes("errand")) {
    return {
      reportType: "daily_support",
      requiredSections: ["Task summary", "Meal/errand status", "Home check-in", "Family update"],
      uploadSlots: ["Receipt", "Task photo"]
    };
  }

  return {
    reportType: "general_care",
    requiredSections: ["Summary", "Caregiver note", "Family update"],
    uploadSlots: ["Photo", "Voice note"]
  };
};

const skillsFor = (serviceType: string) => {
  const reportType = reportPlanFor(serviceType).reportType;
  return [reportType];
};

const zoneFromLocation = (locationDetail?: string) => {
  const detail = (locationDetail || "").toLowerCase();

  if (detail.includes("hospital") || detail.includes("clinic")) {
    return "Medical";
  }

  if (detail.includes("lab") || detail.includes("diagnostic")) {
    return "Diagnostics";
  }

  return "Central";
};

const lifecycleFor = (
  status: BookingStatus,
  lastActor: SessionUser["role"] | "system"
): BookingLifecycle => {
  const allowedNextStatuses = transitionMap[status];
  const nextStatus = allowedNextStatuses[0] ?? status;

  return {
    allowedNextStatuses,
    currentStep: stepLabels[status],
    nextStep: stepLabels[nextStatus],
    lastActor
  };
};

const trackingFor = (booking: CareBooking): BookingTracking => {
  const tracking = booking.tracking;
  const status = booking.status;
  const etaByStatus: Partial<Record<BookingStatus, number>> = {
    requested: 12,
    searching: 10,
    assigned: 8,
    accepted: 7,
    en_route: Math.max(2, (tracking?.etaMinutes ?? 8) - 2),
    arrived: 0,
    in_progress: 0,
    completed: 0,
    payment_settled: 0,
    report_generated: 0,
    cancelled: 0
  };

  return {
    etaMinutes: etaByStatus[status] ?? tracking?.etaMinutes ?? 8,
    distanceKm: tracking?.distanceKm ?? 3.2,
    destinationLabel:
      tracking?.destinationLabel || booking.requestDetails?.location.label || "Care location",
    customerLocation: tracking?.customerLocation || defaultCustomerLocation,
    caretakerLocation: tracking?.caretakerLocation || defaultCaretakerLocation,
    lastLocationAt: tracking?.lastLocationAt || now(),
    routeStatus:
      status === "arrived" || status === "in_progress"
        ? "arrived"
        : status === "completed" || status === "payment_settled" || status === "report_generated"
          ? "completed"
          : status === "en_route"
            ? "tracking"
            : tracking?.routeStatus || "pending"
  };
};

const slaFor = (booking: CareBooking): BookingSla => {
  const timestamp = now();
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
    assignmentDueAt,
    arrivalDueAt,
    status: breached ? "breached" : watch ? "watch" : booking.sla?.status || "healthy",
    breachReason: breached
      ? assignmentPending
        ? "Assignment SLA breached"
        : "Arrival SLA breached"
      : ""
  };
};

const enrichBooking = (
  booking: CareBooking,
  actor: SessionUser["role"] | "system" = "system"
): CareBooking => {
  const city = booking.matching?.city || "Bengaluru";
  const zone =
    booking.matching?.zone || zoneFromLocation(booking.requestDetails?.location.detail);
  const scheduledFor = booking.scheduledFor || now();
  const requestPrice = booking.requestDetails?.pricing;

  return {
    ...booking,
    lifecycle: lifecycleFor(booking.status, actor),
    matching: {
      requiredSkills: booking.matching?.requiredSkills?.length
        ? booking.matching.requiredSkills
        : skillsFor(booking.serviceType),
      preferredLanguages: booking.matching?.preferredLanguages?.length
        ? booking.matching.preferredLanguages
        : ["English", "Hindi"],
      city,
      zone,
      priority: booking.matching?.priority || "normal",
      preferredCaretakerId: booking.matching?.preferredCaretakerId || "",
      assignmentCapacityRequired: booking.matching?.assignmentCapacityRequired || 1
    },
    scheduleIndex: {
      dateKey: dateKeyFor(scheduledFor),
      hourKey: hourKeyFor(scheduledFor),
      statusKey: booking.status,
      city,
      zone
    },
    payment: {
      estimatedTotal:
        booking.payment?.estimatedTotal || requestPrice?.estimatedTotal || "Pending",
      careEstimate: booking.payment?.careEstimate || requestPrice?.careEstimate || "Pending",
      coordinationFee:
        booking.payment?.coordinationFee || requestPrice?.coordinationFee || "Included",
      method: booking.payment?.method || "pending",
      status: booking.payment?.status || "pending",
      invoiceId: booking.payment?.invoiceId || ""
    },
    familyUpdates: {
      inApp: booking.familyUpdates?.inApp || "queued",
      whatsapp: booking.familyUpdates?.whatsapp || "pending",
      sms: booking.familyUpdates?.sms || "pending",
      voiceNote: booking.familyUpdates?.voiceNote || "not_requested",
      recipients: booking.familyUpdates?.recipients || [booking.customerId].filter(Boolean)
    },
    serviceReport: booking.serviceReport || reportPlanFor(booking.serviceType),
    tracking: trackingFor(booking),
    sla: slaFor(booking)
  };
};

const activePathFor = (session: SessionUser) => {
  if (session.role === "customer") {
    return `users/${session.uid}/activeBookingId`;
  }

  if (session.role === "caretaker") {
    return `caretakers/${session.uid}/activeBookingId`;
  }

  return "operations/activeBookingId";
};

const writeBookingIndexes = async (booking: CareBooking) => {
  if (!db || !clientDatabaseWritesEnabled()) {
    return;
  }

  const safeBooking = enrichBooking(booking);
  const indexUpdates: Record<string, unknown> = {
    [`bookings/byId/${safeBooking.id}`]: safeBooking,
    [`users/${safeBooking.customerId}/activeBookingId`]: safeBooking.id,
    "operations/activeBookingId": safeBooking.id,
    [`operations/bookingsByStatus/${safeBooking.status}/${safeBooking.id}`]: true,
    [`operations/bookingsByDate/${safeBooking.scheduleIndex.dateKey}/${safeBooking.id}`]: true,
    [`operations/bookingsByZone/${safeBooking.scheduleIndex.zone}/${safeBooking.id}`]: true,
    [`operations/bookingsByCustomer/${safeBooking.customerId}/${safeBooking.id}`]: true
  };

  if (safeBooking.caretakerId) {
    indexUpdates[`caretakers/${safeBooking.caretakerId}/activeBookingId`] =
      safeBooking.id;
    indexUpdates[
      `operations/bookingsByCaretaker/${safeBooking.caretakerId}/${safeBooking.id}`
    ] = true;
  }

  await Promise.all([
    update(ref(db), indexUpdates),
    set(bookingRef(db, safeBooking.id), safeBooking)
  ]);
};

const saveBooking = (booking: CareBooking) => {
  const safeBooking = enrichBooking(booking);
  writeLocalBooking(safeBooking);
  writeBookingIndexes(safeBooking).catch(() => writeLocalBooking(safeBooking));
};

const postTrustedBookingAction = async (
  path: string,
  body: Record<string, unknown>
) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => null)) as {
      booking?: CareBooking;
      error?: string;
    } | null;

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        error: payload?.error || "Booking action failed"
      };
    }

    return { ok: true as const, booking: payload?.booking };
  } catch {
    return { ok: false as const, status: 0, error: "Network error" };
  }
};

const confirmedBookingAction = async (path: string, body: Record<string, unknown>) => {
  const result = await postTrustedBookingAction(path, body);

  if (!result?.ok || !result.booking) {
    throw new Error(result?.error || "Booking action was not confirmed by the backend");
  }

  writeLocalBooking(enrichBooking(result.booking));
  return result.booking;
};

const fetchTrustedActiveBooking = async (bookingId?: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  const query = bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : "";

  try {
    const response = await fetch(`/api/bookings${query}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as { booking?: CareBooking | null; serverTime?: number };
  } catch {
    return null;
  }
};

const patchBooking = (
  patch: Partial<CareBooking>,
  label: string,
  actor: SessionUser["role"] | "system" = "system"
) => {
  const nextBooking = addTimeline(
    {
      ...readLocalBooking(),
      ...patch
    },
    label
  );

  saveBooking(enrichBooking(nextBooking, actor));
};

const statusLabel: Record<BookingStatus, string> = {
  none: "No active booking",
  requested: "Booking requested",
  searching: "Finding the best caregiver",
  assigned: "Caretaker assigned",
  accepted: "Booking accepted",
  en_route: "Caretaker is on the way",
  arrived: "Caretaker arrived",
  in_progress: "Visit in progress",
  completed: "Booking completed",
  payment_settled: "Payment settled",
  report_generated: "Care report generated",
  cancelled: "Booking cancelled"
};

const canTransition = (from: BookingStatus, to: BookingStatus) =>
  transitionMap[from]?.includes(to);

const readCaretakerProfiles = async () => {
  if (!db) {
    return [demoCaretakerProfile];
  }

  const database = db;

  try {
    const snapshot = await get(ref(database, "caretakers"));
    const records = snapshot.val() as Record<string, Partial<CaretakerMatchProfile>> | null;

    if (!records) {
      return [demoCaretakerProfile];
    }

    return Object.entries(records).map(([uid, profile]) => ({
      ...demoCaretakerProfile,
      ...profile,
      uid: profile.uid || uid
    }));
  } catch {
    return [demoCaretakerProfile];
  }
};

const scoreCaretaker = (booking: CareBooking, caretaker: CaretakerMatchProfile) => {
  const skillMatches = booking.matching.requiredSkills.filter((skill) =>
    caretaker.skills.includes(skill)
  ).length;
  const languageMatches = booking.matching.preferredLanguages.filter((language) =>
    caretaker.languages.includes(language)
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

const findBestCaretaker = async (booking: CareBooking) => {
  const profiles = await readCaretakerProfiles();
  const candidates = profiles
    .filter((profile) => profile.available)
    .sort((a, b) => scoreCaretaker(booking, b) - scoreCaretaker(booking, a));

  return candidates[0] || demoCaretakerProfile;
};

export const BookingService = {
  subscribe(session: SessionUser, callback: (booking: CareBooking) => void) {
    callback(readLocalBooking());
    localSubscribers.add(callback);
    let latestBookingId = readLocalBooking().id !== "demo-booking" ? readLocalBooking().id : "";
    let trustedPoll: number | null = null;

    if (typeof window !== "undefined") {
      const refreshTrustedBooking = () => {
        fetchTrustedActiveBooking(latestBookingId).then((result) => {
          if (result?.booking) {
            latestBookingId = result.booking.id;
            writeLocalBooking(enrichBooking(result.booking));
          }
        });
      };

      refreshTrustedBooking();
      trustedPoll = window.setInterval(refreshTrustedBooking, 5000);
    }

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
        if (trustedPoll) {
          window.clearInterval(trustedPoll);
        }
      };
    }

    const database = db;
    let activeBookingPath = "";
    const activeRef = ref(database, activePathFor(session));

    const unsubscribeActive = onValue(
      activeRef,
      (snapshot) => {
        const bookingId = snapshot.val() as string | null;

        if (!bookingId) {
          callback(readLocalBooking());
          return;
        }

        latestBookingId = bookingId;

        if (activeBookingPath) {
          off(ref(database, activeBookingPath));
        }

        activeBookingPath = `bookings/byId/${bookingId}`;

        onValue(ref(database, activeBookingPath), (bookingSnapshot) => {
          const booking =
            (bookingSnapshot.val() as CareBooking | null) ?? readLocalBooking();
          writeLocalBooking(enrichBooking(booking));
        });
      },
      () => {
        callback(readLocalBooking());
      }
    );

    return () => {
      localSubscribers.delete(callback);
      if (trustedPoll) {
        window.clearInterval(trustedPoll);
      }
      unsubscribeActive();

      if (activeBookingPath) {
        off(ref(database, activeBookingPath));
      }
    };
  },

  createBooking(
    session: SessionUser,
    serviceType: string,
    requestDetails?: BookingRequestDetails
  ) {
    const timestamp = now();
    const scheduledFor = requestDetails?.schedule.requestedFor ?? timestamp + 60 * 60 * 1000;
    const bookingNotes = requestDetails
      ? [
          `${requestDetails.service} requested for ${requestDetails.careFor.displayName}`,
          `Duration: ${requestDetails.duration.label}`,
          `When: ${requestDetails.schedule.label}`,
          `Where: ${requestDetails.location.label}`,
          `Estimate: ${requestDetails.pricing.estimatedTotal}`
        ].join(" | ")
      : `${serviceType} requested for next available slot`;
    const booking: CareBooking = {
      id: `booking-${timestamp}`,
      serviceType,
      status: "searching",
      customerId: session.uid,
      customerName: session.name,
      caretakerId: "",
      caretakerName: "Awaiting assignment",
      scheduledFor,
      notes: bookingNotes,
      createdAt: timestamp,
      updatedAt: timestamp,
      requestDetails,
      lifecycle: lifecycleFor("searching", "customer"),
      matching: {
        requiredSkills: skillsFor(serviceType),
        preferredLanguages: ["English", "Hindi"],
        city: "Bengaluru",
        zone: zoneFromLocation(requestDetails?.location.detail),
        priority: requestDetails?.schedule.label === "Now" ? "urgent" : "normal",
        preferredCaretakerId: "",
        assignmentCapacityRequired: 1
      },
      scheduleIndex: {
        dateKey: dateKeyFor(scheduledFor),
        hourKey: hourKeyFor(scheduledFor),
        statusKey: "searching",
        city: "Bengaluru",
        zone: zoneFromLocation(requestDetails?.location.detail)
      },
      payment: {
        estimatedTotal: requestDetails?.pricing.estimatedTotal || "Pending",
        careEstimate: requestDetails?.pricing.careEstimate || "Pending",
        coordinationFee: requestDetails?.pricing.coordinationFee || "Included",
        method: "pending",
        status: "pending",
        invoiceId: ""
      },
      familyUpdates: {
        inApp: "queued",
        whatsapp: "queued",
        sms: "pending",
        voiceNote: "not_requested",
        recipients: [session.uid]
      },
      serviceReport: reportPlanFor(serviceType),
      dispatch: {
        mode: "area_broadcast",
        status: "broadcasting",
        offerExpiresAt: timestamp + 90 * 1000,
        candidateCount: 0,
        offers: {}
      },
      completion: {
        paymentReleaseStatus: "not_ready"
      },
      tracking: {
        etaMinutes: 12,
        distanceKm: 3.2,
        destinationLabel: requestDetails?.location.label || "Care location",
        customerLocation: defaultCustomerLocation,
        caretakerLocation: defaultCaretakerLocation,
        lastLocationAt: timestamp,
        routeStatus: "pending"
      },
      sla: {
        assignmentDueAt: timestamp + 10 * 60 * 1000,
        arrivalDueAt: scheduledFor + 20 * 60 * 1000,
        status: "healthy",
        breachReason: ""
      },
      timeline: [{ label: `${serviceType} sent to nearby caregivers`, at: timestamp }]
    };

    saveBooking(booking);
    // Booking creation is persisted explicitly by the customer confirmation flow.
    NotificationService.create({
      userId: session.uid,
      role: "admin",
      title: "New booking request",
      body: requestDetails
        ? `${session.name} requested ${requestDetails.service} for ${requestDetails.careFor.displayName}.`
        : `${session.name} requested ${serviceType}.`,
      priority: "normal"
    });
    NotificationService.create({
      userId: session.uid,
      role: "customer",
      title: "Care request received",
      body: requestDetails
        ? `We are arranging ${requestDetails.service} for ${requestDetails.careFor.displayName}.`
        : `We are arranging ${serviceType}.`,
      priority: "normal",
      channel: "in_app"
    });

    return booking;
  },

  async persistBooking(booking: CareBooking) {
    const result = await postTrustedBookingAction("/api/bookings", { booking });

    if (result?.ok && result.booking) {
      writeLocalBooking(enrichBooking(result.booking));
      return result.booking;
    }

    return null;
  },

  async assignCaretaker() {
    const booking = enrichBooking(readLocalBooking(), "admin");

    if (!canTransition(booking.status, "assigned")) {
      NotificationService.create({
        userId: booking.customerId,
        role: "admin",
        title: "Assignment skipped",
        body: `Cannot assign caretaker while booking is ${booking.status}.`,
        priority: "urgent"
      });
      return;
    }

    const trustedResult = await postTrustedBookingAction(
      `/api/bookings/${encodeURIComponent(booking.id)}/assign`,
      {}
    );

    if (trustedResult?.ok && trustedResult.booking) {
      writeLocalBooking(enrichBooking(trustedResult.booking));
      NotificationService.create({
        userId: trustedResult.booking.customerId,
        role: "caretaker",
        title: "Booking assigned",
        body: `You have a new ${trustedResult.booking.serviceType} booking.`,
        priority: "normal"
      });
      return;
    }

    if (!allowLocalFallback()) {
      NotificationService.create({
        userId: booking.customerId,
        role: "admin",
        title: "Assignment failed",
        body: "The backend did not confirm the caregiver assignment.",
        priority: "urgent"
      });
      return;
    }

    const bestCaretaker = await findBestCaretaker(booking);

    patchBooking(
      {
        status: "assigned",
        caretakerId: bestCaretaker.uid,
        caretakerName: bestCaretaker.name,
        matching: {
          ...booking.matching,
          preferredCaretakerId: bestCaretaker.uid
        }
      },
      `Admin assigned ${bestCaretaker.name}`,
      "admin"
    );
    NotificationService.create({
      userId: readLocalBooking().customerId,
      role: "caretaker",
      title: "Booking assigned",
      body: `You have a new ${booking.serviceType} booking.`,
      priority: "normal"
    });
  },

  async acceptDispatchOffer() {
    const booking = readLocalBooking();

    return confirmedBookingAction(
      `/api/bookings/${encodeURIComponent(booking.id)}/accept`,
      {}
    );
  },

  async rejectDispatchOffer(reason = "Caregiver unavailable") {
    const booking = readLocalBooking();

    return confirmedBookingAction(
      `/api/bookings/${encodeURIComponent(booking.id)}/reject`,
      { reason }
    );
  },

  startWithCustomerOtp(otp: string) {
    const booking = readLocalBooking();

    return confirmedBookingAction(
      `/api/bookings/${encodeURIComponent(booking.id)}/start`,
      { otp }
    );
  },

  verifyCompletion(approved = true, note = "") {
    const booking = readLocalBooking();

    return confirmedBookingAction(
      `/api/bookings/${encodeURIComponent(booking.id)}/verify-completion`,
      { approved, note }
    );
  },

  async updateStatus(status: BookingStatus, actor: SessionUser["role"] | "system" = "system") {
    const currentBooking = readLocalBooking();

    if (!canTransition(currentBooking.status, status) && currentBooking.status !== status) {
      NotificationService.create({
        userId: currentBooking.customerId,
        role: "admin",
        title: "Invalid booking transition",
        body: `Cannot move booking from ${currentBooking.status} to ${status}.`,
        priority: "urgent"
      });
      throw new Error(`Cannot move booking from ${currentBooking.status} to ${status}`);
    }

    try {
      await confirmedBookingAction(
        `/api/bookings/${encodeURIComponent(currentBooking.id)}/status`,
        { status }
      );
    } catch (error) {
      if (!allowLocalFallback()) {
        NotificationService.create({
          userId: currentBooking.customerId,
          role: "admin",
          title: "Status update failed",
          body: "The backend did not confirm this care status change.",
          priority: "urgent"
        });
        throw error;
      }

      patchBooking(
        {
          status
        },
        statusLabel[status],
        actor
      );
    }
    NotificationService.create({
      userId: readLocalBooking().customerId,
      role: "all",
      title: statusLabel[status],
      body: `Booking status changed to ${status}.`,
      priority: status === "cancelled" ? "urgent" : "normal"
    });
  },

  async cancelBooking(
    reason = "Customer requested cancellation",
    actor: "customer" | "caretaker" | "admin" | "system" = "customer"
  ) {
    const booking = readLocalBooking();
    try {
      return await confirmedBookingAction(
        `/api/bookings/${encodeURIComponent(booking.id)}/cancel`,
        { reason }
      );
    } catch (error) {
      if (!allowLocalFallback()) {
        NotificationService.create({
          userId: booking.customerId,
          role: "admin",
          title: "Cancellation failed",
          body: "The backend did not confirm this cancellation.",
          priority: "urgent"
        });
        throw error;
      }

      patchBooking(
        {
          status: "cancelled",
          cancellation: {
            cancelledBy: actor,
            reason,
            refundEligible: booking.payment.status !== "paid",
            penaltyApplies: actor === "caretaker",
            cancelledAt: now()
          }
        },
        "Booking cancelled",
        actor
      );
      return readLocalBooking();
    }
  },

  rateBooking(score: number, note = "Care completed well") {
    const booking = readLocalBooking();
    return postTrustedBookingAction(
      `/api/bookings/${encodeURIComponent(booking.id)}/rating`,
      { score, note }
    ).then((result) => {
      if (result?.ok && result.booking) {
        writeLocalBooking(enrichBooking(result.booking));
        return;
      }

      if (!allowLocalFallback()) {
        NotificationService.create({
          userId: booking.customerId,
          role: "customer",
          title: "Rating not saved",
          body: "We could not confirm this rating with the backend.",
          priority: "urgent"
        });
        return;
      }

      patchBooking(
        {
          rating: {
            score,
            note,
            ratedBy: booking.customerId,
            ratedAt: now()
          }
        },
        `Family rated visit ${score}/5`,
        "customer"
      );
    });
  },

  authorizePayment(method: BookingPayment["method"] = "upi") {
    const booking = readLocalBooking();

    patchBooking(
      {
        payment: {
          ...booking.payment,
          method,
          status: "authorized"
        }
      },
      "Payment authorized",
      "customer"
    );
  },

  markPaymentPaid(invoiceId = `invoice-${now()}`) {
    const booking = readLocalBooking();

    patchBooking(
      {
        payment: {
          ...booking.payment,
          invoiceId,
          status: "paid"
        }
      },
      "Payment completed",
      "admin"
    );
  },

  clearBooking() {
    const booking = readLocalBooking();

    if (db && booking.id !== "demo-booking") {
      remove(ref(db, `operations/bookingsByStatus/${booking.status}/${booking.id}`)).catch(
        () => undefined
      );
    }

    saveBooking(addTimeline(createDefaultBooking(), "Booking cleared"));
  }
};
