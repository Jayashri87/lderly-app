import { Database } from "firebase/database";
import { get, off, onValue, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";
import { NotificationService } from "./notificationService";

export type BookingStatus =
  | "none"
  | "requested"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "completed"
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
  timeline: Array<{
    label: string;
    at: number;
  }>;
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
  timeline: [{ label: "No active booking", at: now() }]
});

let localBooking = createDefaultBooking();
const localSubscribers = new Set<(booking: CareBooking) => void>();

const canUseStorage = () => typeof window !== "undefined";
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
    serviceReport: booking.serviceReport || reportPlanFor(booking.serviceType)
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
  if (!db) {
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

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as { booking?: CareBooking };
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
  assigned: "Caretaker assigned",
  accepted: "Booking accepted",
  in_progress: "Visit in progress",
  completed: "Booking completed",
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

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
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
      status: "requested",
      customerId: session.uid,
      customerName: session.name,
      caretakerId: "",
      caretakerName: "Awaiting assignment",
      scheduledFor,
      notes: bookingNotes,
      createdAt: timestamp,
      updatedAt: timestamp,
      requestDetails,
      lifecycle: lifecycleFor("requested", "customer"),
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
        statusKey: "requested",
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
      timeline: [{ label: `${serviceType} requested`, at: timestamp }]
    };

    saveBooking(booking);
    postTrustedBookingAction("/api/bookings", { booking }).then((result) => {
      if (result?.booking) {
        writeLocalBooking(enrichBooking(result.booking));
      }
    });
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

    if (trustedResult?.booking) {
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

  updateStatus(status: BookingStatus, actor: SessionUser["role"] | "system" = "system") {
    const currentBooking = readLocalBooking();

    if (!canTransition(currentBooking.status, status) && currentBooking.status !== status) {
      NotificationService.create({
        userId: currentBooking.customerId,
        role: "admin",
        title: "Invalid booking transition",
        body: `Cannot move booking from ${currentBooking.status} to ${status}.`,
        priority: "urgent"
      });
      return;
    }

    postTrustedBookingAction(
      `/api/bookings/${encodeURIComponent(currentBooking.id)}/status`,
      { status }
    ).then((result) => {
      if (result?.booking) {
        writeLocalBooking(enrichBooking(result.booking));
      }
    });

    patchBooking(
      {
        status
      },
      statusLabel[status],
      actor
    );
    NotificationService.create({
      userId: readLocalBooking().customerId,
      role: "all",
      title: statusLabel[status],
      body: `Booking status changed to ${status}.`,
      priority: status === "cancelled" ? "urgent" : "normal"
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
