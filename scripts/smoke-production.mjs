import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const loadEnvFile = (path) => {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, rawKey, value] = match;
    const key = rawKey.replace(/^\uFEFF/, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const requiredEnv = [
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "LDERLY_ADMIN_USERNAME",
  "LDERLY_ADMIN_PASSWORD",
  "LDERLY_CARETAKER_USERNAME",
  "LDERLY_CARETAKER_PASSWORD",
  "LDERLY_CUSTOMER_USERNAME",
  "LDERLY_CUSTOMER_PASSWORD"
];

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length) {
  console.error(`Missing smoke-test env vars:\n- ${missingEnv.join("\n- ")}`);
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
const database = getDatabase(app);

const assertions = [];
const createdPaths = [];
const createdReliability = [];

const pass = (label) => {
  assertions.push({ label, ok: true });
  console.log(`PASS ${label}`);
};

const fail = (label, detail) => {
  assertions.push({ label, ok: false, detail });
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
};

const expect = (condition, label, detail = "") => {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail);
  }
};

const request = async (path, options = {}, cookie = "") => {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    response,
    json,
    text,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie
  };
};

const login = async (role) => {
  const prefix = role.toUpperCase();
  const result = await request(`/api/auth/${role}`, {
    method: "POST",
    body: JSON.stringify({
      username: process.env[`LDERLY_${prefix}_USERNAME`],
      password: process.env[`LDERLY_${prefix}_PASSWORD`]
    })
  });

  expect(result.response.ok, `${role} login returns 200`, result.text);
  expect(Boolean(result.cookie), `${role} login sets signed cookie`);
  return result.cookie;
};

const buildSmokeBooking = (suffix = "") => {
  const now = Date.now();
  const bookingId = `smoke-booking-${now}${suffix}`;
  const scheduledFor = now + 60 * 60 * 1000;
  const dateKey = new Date(scheduledFor).toISOString().slice(0, 10);
  const hourKey = new Date(scheduledFor).toISOString().slice(0, 13);

  return {
    id: bookingId,
    serviceType: "Doctor Visit - Book Appointment",
    status: "requested",
    customerId: "demo-customer",
    customerName: "Smoke Customer",
    caretakerId: "",
    caretakerName: "Awaiting assignment",
    scheduledFor,
    notes: "Production smoke test booking",
    createdAt: now,
    updatedAt: now,
    requestDetails: {
      careFor: {
        relationship: "Mom",
        displayName: "Smoke Mom"
      },
      careNeed: "Health assistance",
      service: "Doctor Visit - Book Appointment",
      duration: {
        label: "1 Hour",
        price: "Rs 500",
        note: "Smoke test"
      },
      schedule: {
        label: "Today later",
        detail: "Smoke test slot",
        requestedFor: scheduledFor
      },
      location: {
        label: "Smoke care address",
        detail: "Jayanagar Bengaluru"
      },
      pricing: {
        careEstimate: "Rs 500",
        coordinationFee: "Included",
        estimatedTotal: "Rs 500"
      },
      trust: ["Verified caregivers"]
    },
    lifecycle: {
      allowedNextStatuses: ["assigned", "cancelled"],
      currentStep: "Request Created",
      nextStep: "Caregiver Assigned",
      lastActor: "customer"
    },
    matching: {
      requiredSkills: ["doctor_visit"],
      preferredLanguages: ["English", "Hindi"],
      city: "Bengaluru",
      zone: "South",
      priority: "normal",
      preferredCaretakerId: "",
      assignmentCapacityRequired: 1
    },
    scheduleIndex: {
      dateKey,
      hourKey,
      statusKey: "requested",
      city: "Bengaluru",
      zone: "South"
    },
    payment: {
      estimatedTotal: "Rs 500",
      careEstimate: "Rs 500",
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
      recipients: ["demo-customer"]
    },
    serviceReport: {
      reportType: "doctor_visit",
      requiredSections: ["Appointment details", "Doctor notes"],
      uploadSlots: ["Prescription"]
    },
    timeline: [{ label: "Smoke booking requested", at: now }]
  };
};

const seedCaretaker = async () => {
  await database.ref("caretakers/demo-caretaker").update({
    uid: "demo-caretaker",
    name: "Smoke Caretaker",
    available: true,
    status: "available",
    city: "Bengaluru",
    zone: "South",
    skills: ["doctor_visit", "lab_support", "medicine_help"],
    languages: ["English", "Hindi"],
    rating: 4.9,
    activeAssignments: 0,
    maxAssignments: 5,
    verified: true,
    trained: true,
    yearsExperience: 5,
    serviceZones: ["South", "Central", "Medical"],
    punctualityScore: 99,
    repeatVisits: 1,
    familiarFamilies: ["demo-customer"],
    activeBookingId: null
  });
  await database.ref("caretakers/smoke-backup-caretaker").update({
    uid: "smoke-backup-caretaker",
    name: "Smoke Backup Caretaker",
    available: true,
    status: "available",
    city: "Bengaluru",
    zone: "South",
    skills: ["doctor_visit", "lab_support", "medicine_help"],
    languages: ["English", "Hindi"],
    rating: 4.7,
    activeAssignments: 0,
    maxAssignments: 4,
    verified: true,
    trained: true,
    yearsExperience: 4,
    serviceZones: ["South", "Central"],
    punctualityScore: 96,
    repeatVisits: 0,
    familiarFamilies: [],
    currentLocation: { lat: 12.986, lng: 77.607 },
    activeBookingId: null
  });
  pass("smoke caretaker seeded");
};

const cleanupBooking = async (booking) => {
  const updates = {
    [`bookings/byId/${booking.id}`]: null,
    [`users/${booking.customerId}/activeBookingId`]: null,
    "operations/activeBookingId": null,
    [`operations/bookingsByStatus/requested/${booking.id}`]: null,
    [`operations/bookingsByStatus/searching/${booking.id}`]: null,
    [`operations/bookingsByStatus/assigned/${booking.id}`]: null,
    [`operations/bookingsByStatus/accepted/${booking.id}`]: null,
    [`operations/bookingsByStatus/en_route/${booking.id}`]: null,
    [`operations/bookingsByStatus/arrived/${booking.id}`]: null,
    [`operations/bookingsByStatus/in_progress/${booking.id}`]: null,
    [`operations/bookingsByStatus/completed/${booking.id}`]: null,
    [`operations/bookingsByStatus/payment_settled/${booking.id}`]: null,
    [`operations/bookingsByStatus/report_generated/${booking.id}`]: null,
    [`operations/bookingsByStatus/cancelled/${booking.id}`]: null,
    [`operations/bookingsByDate/${booking.scheduleIndex.dateKey}/${booking.id}`]: null,
    [`operations/bookingsByZone/${booking.scheduleIndex.zone}/${booking.id}`]: null,
    [`operations/bookingsByZone/South/${booking.id}`]: null,
    [`operations/bookingsByCustomer/${booking.customerId}/${booking.id}`]: null,
    "caretakers/demo-caretaker/activeBookingId": null,
    "caretakers/demo-caretaker/activeAssignments": 0,
    "caretakers/smoke-backup-caretaker/activeBookingId": null,
    "caretakers/smoke-backup-caretaker/activeAssignments": 0,
    [`operations/bookingsByCaretaker/demo-caretaker/${booking.id}`]: null,
    [`operations/bookingsByCaretaker/smoke-backup-caretaker/${booking.id}`]: null,
    [`operations/reassignmentQueue/completed/${booking.id}`]: null,
    [`trustLedger/caregivers/demo-caretaker/${booking.id}`]: null,
    [`trustLedger/caregivers/smoke-backup-caretaker/${booking.id}`]: null
  };

  await database.ref().update(updates);
};

try {
  const status = await request("/api/system/status");
  expect(status.response.ok, "system status returns 200", status.text);
  expect(status.json?.firebaseAdmin?.configured === true, "Firebase Admin configured");
  expect(
    status.json?.productionReadiness?.stricterRulesDeployed === true,
    "strict Firebase rules deployed"
  );
  expect(
    status.json?.productionReadiness?.caretakerScopedFirebaseRulesPrepared === true,
    "caretaker Firebase rules are scoped"
  );
  expect(
    status.json?.productionReadiness?.serverOwnedNotificationWrites === true,
    "notification writes are server-owned"
  );
  expect(
    status.json?.productionReadiness?.productionMockProvidersDisabled === true,
    "production mock providers fail closed"
  );
  expect(
    status.json?.productionReadiness?.paymentMockFailClosed === true,
    "payment mocks fail closed in production"
  );
  expect(
    status.json?.productionReadiness?.voiceNoteMockFailClosed === true,
    "voice-note mocks fail closed in production"
  );
  expect(
    status.json?.productionReadiness?.kycMockFailClosed === true,
    "KYC upload mocks fail closed in production"
  );
  expect(
    status.json?.productionReadiness?.githubActionsCiPrepared === true,
    "GitHub Actions CI is prepared"
  );
  expect(
    status.json?.productionReadiness?.groupedCiSmokeRunner === true,
    "grouped CI smoke runner is prepared"
  );
  expect(
    status.json?.productionReadiness?.featureFlags?.stagedRolloutReady === true,
    "feature flags are staged-rollout ready"
  );
  expect(
    status.json?.productionReadiness?.razorpayConfigured === true,
    "Razorpay order keys configured"
  );
  expect(status.json?.productionReadiness?.pwaManifest === true, "PWA manifest is prepared");
  expect(status.json?.productionReadiness?.legalPages === true, "legal pages are prepared");
  expect(
    status.json?.productionReadiness?.firebaseAppCheckPrepared === true,
    "Firebase App Check is scaffolded"
  );
  expect(
    status.json?.productionReadiness?.internalOpsAlertsApi === true,
    "internal ops alerts API is prepared"
  );
  expect(
    status.json?.productionReadiness?.indiaFirstCommunication?.firebasePushPrepared === true,
    "India-first communication readiness is exposed"
  );
  expect(
    status.json?.productionReadiness?.pushTokenRegistrationApi === true,
    "push token registration API is prepared"
  );
  expect(
    status.json?.productionReadiness?.pushDispatchApi === true,
    "push dispatch API is prepared"
  );
  expect(
    status.json?.productionReadiness?.caretakerAttendanceApi === true,
    "caretaker attendance API is prepared"
  );
  expect(
    status.json?.productionReadiness?.shiftAnalyticsApi === true,
    "shift analytics are prepared"
  );
  expect(
    status.json?.productionReadiness?.familyReportAccessApi === true,
    "family report access API is prepared"
  );
  expect(
    status.json?.productionReadiness?.aiReportSummaryApi === true,
    "AI report summary API is prepared"
  );
  expect(
    status.json?.productionReadiness?.monthlyNriReportApi === true,
    "monthly NRI report API is prepared"
  );
  expect(
    status.json?.productionReadiness?.invoiceGstApi === true,
    "GST invoice API is prepared"
  );
  expect(
    status.json?.productionReadiness?.caregiverPayoutApi === true,
    "caregiver payout API is prepared"
  );
  expect(
    status.json?.productionReadiness?.subscriptionPlanApi === true,
    "subscription plan API is prepared"
  );
  expect(
    status.json?.productionReadiness?.medicationScheduleApi === true,
    "medication schedule API is prepared"
  );
  expect(
    status.json?.productionReadiness?.medicationAdherenceApi === true,
    "medication adherence API is prepared"
  );
  expect(
    status.json?.productionReadiness?.careRiskSummaryApi === true,
    "care risk summary API is prepared"
  );
  expect(
    status.json?.productionReadiness?.fallRiskIndicators === true,
    "fall risk indicators are prepared"
  );
  expect(
    status.json?.productionReadiness?.missedCareDetection === true,
    "missed care detection is prepared"
  );
  expect(
    status.json?.productionReadiness?.emergencyReadinessScore === true,
    "emergency readiness score is prepared"
  );
  expect(
    status.json?.productionReadiness?.dementiaChronicConditionFlags === true,
    "dementia and chronic condition flags are prepared"
  );
  expect(
    status.json?.productionReadiness?.incidentReportApi === true,
    "incident report API is prepared"
  );
  expect(
    status.json?.productionReadiness?.caretakerTrainingBadgeApi === true,
    "caretaker training badge API is prepared"
  );
  expect(
    status.json?.productionReadiness?.caregiverReliabilityScoringApi === true,
    "caregiver reliability scoring API is prepared"
  );
  expect(
    status.json?.productionReadiness?.complaintLifecycleApi === true,
    "complaint lifecycle API is prepared"
  );
  expect(
    status.json?.productionReadiness?.refundLifecycleApi === true,
    "refund lifecycle API is prepared"
  );
  expect(
    status.json?.productionReadiness?.emergencyCommandCenterApi === true,
    "emergency command center API is prepared"
  );
  expect(
    status.json?.productionReadiness?.opsCommandCenterQueues === true,
    "ops command center queues are prepared"
  );
  expect(
    status.json?.productionReadiness?.opsCommandCenterActions === true,
    "ops command center actions are prepared"
  );
  expect(
    status.json?.productionReadiness?.emergencyQueueUi === true,
    "emergency queue UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.incidentQueueUi === true,
    "incident queue UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.panicSosQueueUi === true,
    "panic SOS queue UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.delayedBookingQueueUi === true,
    "delayed booking queue UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.tanstackQueryProvider === true,
    "TanStack Query provider is prepared"
  );
  expect(
    status.json?.productionReadiness?.shadcnStylePrimitives === true,
    "shadcn-style primitives are prepared"
  );
  expect(
    status.json?.productionReadiness?.sentrySdkPrepared === true,
    "Sentry SDK is prepared"
  );
  expect(
    status.json?.productionReadiness?.analyticsFunnelKpis === true,
    "analytics funnel KPIs are prepared"
  );
  expect(
    status.json?.productionReadiness?.realtimeSlaExperience === true,
    "realtime SLA experience is prepared"
  );
  expect(
    status.json?.productionReadiness?.dispatchIntelligenceApi === true,
    "dispatch intelligence API is prepared"
  );
  expect(
    status.json?.productionReadiness?.caregiverReassignmentApi === true,
    "caregiver reassignment API is prepared"
  );
  expect(
    status.json?.productionReadiness?.delayedAssignmentQueue === true,
    "delayed assignment queue is prepared"
  );
  expect(
    status.json?.productionReadiness?.dispatchConflictDetection === true,
    "dispatch conflict detection is prepared"
  );
  expect(
    status.json?.productionReadiness?.backupCaregiverRecommendations === true,
    "backup caregiver recommendations are prepared"
  );
  expect(
    status.json?.productionReadiness?.opsCommandDispatchUi === true,
    "ops command dispatch UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.liveCaregiverAvailabilityBoard === true,
    "live caregiver availability board is prepared"
  );
  expect(
    status.json?.productionReadiness?.freeAiReassuranceApi === true,
    "free AI reassurance API is prepared"
  );
  expect(
    status.json?.productionReadiness?.aiDailyCareSummaryUi === true,
    "AI daily care summary UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.customerRetentionEngineApi === true,
    "customer retention engine API is prepared"
  );
  expect(
    status.json?.productionReadiness?.recurringCareNudgesUi === true,
    "recurring care nudges UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.familyReassuranceDigestUi === true,
    "family reassurance digest UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.continuityCareRecommendations === true,
    "continuity care recommendations are prepared"
  );
  expect(
    status.json?.productionReadiness?.aiOpsSummaryApi === true,
    "AI ops summary API is prepared"
  );
  expect(
    status.json?.productionReadiness?.aiCaregiverNoteCleanupApi === true,
    "AI caregiver note cleanup API is prepared"
  );
  expect(
    status.json?.productionReadiness?.aiAnomalySignals === true,
    "AI anomaly signals are prepared"
  );
  expect(
    status.json?.productionReadiness?.aiMonthlyReportIntelligence === true,
    "AI monthly report intelligence is prepared"
  );
  expect(
    status.json?.productionReadiness?.caregiverTrustProfileUi === true,
    "caregiver trust profile UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.caregiverTrustProfileApi === true,
    "caregiver trust profile API is prepared"
  );
  expect(
    status.json?.productionReadiness?.familyPermissionsUi === true,
    "family permissions UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.visitProofUi === true,
    "visit proof UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.visitProofApi === true,
    "visit proof API is prepared"
  );
  expect(
    status.json?.productionReadiness?.trustLedgerRatingUpdates === true,
    "trust ledger rating updates are prepared"
  );
  expect(
    status.json?.productionReadiness?.sameCaregiverRebookingUi === true,
    "same caregiver rebooking UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.monthlyNriPreviewUi === true,
    "monthly NRI preview UI is prepared"
  );
  expect(
    status.json?.productionReadiness?.awsScaleArchitecturePrepared === true,
    "AWS scale architecture is documented"
  );
  expect(
    status.json?.productionReadiness?.emergencyEscalationApi === true,
    "emergency escalation API is prepared"
  );
  expect(
    status.json?.productionReadiness?.partnerMarketplaceApi === true,
    "partner marketplace API is prepared"
  );

  const manifestResult = await request("/manifest.webmanifest");
  expect(manifestResult.response.ok, "web app manifest is reachable", manifestResult.text);

  const privacyResult = await request("/legal/privacy");
  expect(privacyResult.response.ok, "privacy page is reachable", privacyResult.text);

  const unauthorizedBooking = await request("/api/bookings", {
    method: "POST",
    body: JSON.stringify({})
  });
  expect(
    unauthorizedBooking.response.status === 401,
    "booking creation rejects unsigned callers",
    unauthorizedBooking.text
  );

  const unauthorizedGeo = await request("/api/locations/geocode", {
    method: "POST",
    body: JSON.stringify({ address: "Jayanagar Bengaluru" })
  });
  expect(
    unauthorizedGeo.response.status === 401,
    "geocoding rejects unsigned callers",
    unauthorizedGeo.text
  );

  await seedCaretaker();

  const customerCookie = await login("customer");
  const adminCookie = await login("admin");
  const caretakerCookie = await login("caretaker");
  const booking = buildSmokeBooking();

  const createResult = await request(
    "/api/bookings",
    {
      method: "POST",
      body: JSON.stringify({ booking })
    },
    customerCookie
  );
  createdPaths.push(booking);
  expect(createResult.response.ok, "customer can create trusted booking", createResult.text);
  expect(
    createResult.json?.booking?.matching?.zone === "South",
    "booking gets server-side dispatch zone"
  );

  const analyticsResult = await request(
    "/api/analytics/events",
    {
      method: "POST",
      body: JSON.stringify({
        name: "smoke_booking_created",
        bookingId: booking.id,
        properties: {
          serviceType: booking.serviceType,
          source: "smoke"
        }
      })
    },
    customerCookie
  );
  expect(analyticsResult.response.ok, "customer can capture analytics event", analyticsResult.text);

  const customerRead = await database.ref(`bookings/byId/${booking.id}`).get();
  expect(customerRead.exists(), "booking persisted in Firebase");

  const foreignBooking = {
    ...buildSmokeBooking("-foreign"),
    customerId: "other-customer",
    customerName: "Other Customer",
    caretakerId: "other-caretaker",
    caretakerName: "Other Caretaker"
  };
  await database.ref(`bookings/byId/${foreignBooking.id}`).set(foreignBooking);
  createdPaths.push(foreignBooking);

  const crossCustomerCancelResult = await request(
    `/api/bookings/${encodeURIComponent(foreignBooking.id)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason: "Cross-customer denial smoke check" })
    },
    customerCookie
  );
  expect(
    crossCustomerCancelResult.response.status === 403,
    "customer cannot cancel another customer's booking",
    crossCustomerCancelResult.text
  );

  const crossCaretakerStatusResult = await request(
    `/api/bookings/${encodeURIComponent(foreignBooking.id)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status: "accepted" })
    },
    caretakerCookie
  );
  expect(
    crossCaretakerStatusResult.response.status === 403,
    "caretaker cannot update another caretaker's booking",
    crossCaretakerStatusResult.text
  );

  const crossCustomerRatingResult = await request(
    `/api/bookings/${encodeURIComponent(foreignBooking.id)}/rating`,
    {
      method: "POST",
      body: JSON.stringify({ score: 5, note: "Cross-customer denial smoke check" })
    },
    customerCookie
  );
  expect(
    crossCustomerRatingResult.response.status === 403,
    "customer cannot rate another customer's booking",
    crossCustomerRatingResult.text
  );

  const checkoutResult = await request(
    "/api/payments/checkout",
    {
      method: "POST",
      body: JSON.stringify({ bookingId: booking.id })
    },
    customerCookie
  );
  expect(checkoutResult.response.ok, "customer can create Razorpay order", checkoutResult.text);
  expect(
    ["razorpay", "mock"].includes(checkoutResult.json?.mode),
    "checkout returns Razorpay-compatible payload"
  );

  const supportResult = await request(
    "/api/support/tickets",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        userId: booking.customerId,
        category: "booking",
        priority: "normal",
        subject: "Smoke support ticket",
        description: "Need help with smoke booking coordination."
      })
    },
    customerCookie
  );
  expect(supportResult.response.ok, "customer can create support ticket", supportResult.text);
  if (supportResult.json?.ticket?.id) {
    createdReliability.push({
      kind: "ticket",
      id: supportResult.json.ticket.id,
      userId: booking.customerId,
      priority: "normal"
    });
  }

  const refundResult = await request(
    "/api/payments/refund",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        reason: "Smoke refund workflow validation"
      })
    },
    customerCookie
  );
  expect(refundResult.response.ok, "customer can request refund review", refundResult.text);
  if (refundResult.json?.refund?.id) {
    createdReliability.push({
      kind: "refund",
      id: refundResult.json.refund.id,
      bookingId: booking.id
    });
  }

  if (refundResult.json?.refund?.id) {
    const refundStatusResult = await request(
      `/api/payments/refund/${encodeURIComponent(refundResult.json.refund.id)}/status`,
      {
        method: "POST",
        body: JSON.stringify({
          status: "processed",
          providerRefundId: "smoke-refund-provider-id",
          note: "Smoke refund processed by ops"
        })
      },
      adminCookie
    );
    expect(
      refundStatusResult.response.ok,
      "admin can update refund lifecycle",
      refundStatusResult.text
    );
  }

  const pricingResult = await request(
    "/api/pricing/quote",
    {
      method: "POST",
      body: JSON.stringify({
        serviceType: booking.serviceType,
        durationLabel: booking.requestDetails.duration.label,
        priority: booking.matching.priority,
        distanceKm: 4.2,
        recurring: false
      })
    },
    customerCookie
  );
  expect(pricingResult.response.ok, "customer can get dynamic pricing quote", pricingResult.text);
  expect(
    pricingResult.json?.quote?.estimatedTotal > 0,
    "pricing quote returns payable estimate"
  );

  const profileResult = await request(
    "/api/profiles/care",
    {
      method: "POST",
      body: JSON.stringify({
        profile: {
          elderName: "Smoke Mom",
          age: 72,
          primaryContact: "+91 90000 00000",
          emergencyContact: "Family - +91 90000 00000",
          medicalNotes: "Smoke profile hypertension note",
          allergies: "No known allergies",
          subscriptionPlan: "Premium",
          careRecipients: {
            Mother: {
              relationship: "Mother",
              fullName: "Smoke Mom",
              age: 72,
              phone: "+91 90000 00000",
              address: "Jayanagar Bengaluru",
              healthNotes: "Monitor BP",
              allergies: "No known allergies",
              mobility: "Walks with support",
              language: "Kannada",
              medicationList: ["BP tablet 9 PM"],
              medicalConditions: ["Hypertension"],
              dementiaSupport: false,
              fallRisk: "medium",
              emergencyContacts: [
                {
                  name: "Smoke Family",
                  relationship: "Son",
                  phone: "+91 90000 00000",
                  priority: 1
                }
              ],
              updatedAt: Date.now()
            }
          }
        }
      })
    },
    customerCookie
  );
  expect(profileResult.response.ok, "customer can save medical care profile", profileResult.text);

  const familyResult = await request(
    "/api/profiles/family",
    {
      method: "POST",
      body: JSON.stringify({
        member: {
          name: "Smoke Sibling",
          relationship: "Daughter",
          phone: "+91 91111 11111",
          permissions: ["monitor", "alerts"],
          nriMode: true
        }
      })
    },
    customerCookie
  );
  expect(familyResult.response.ok, "customer can add family access member", familyResult.text);
  const familyMemberId = familyResult.json?.familyMember?.id;

  const pushTokenResult = await request(
    "/api/notifications/push-token",
    {
      method: "POST",
      body: JSON.stringify({
        token: `smoke-web-token-${Date.now()}`,
        platform: "web",
        deviceId: "smoke-web-device"
      })
    },
    customerCookie
  );
  expect(
    pushTokenResult.response.ok,
    "customer can register push notification token",
    pushTokenResult.text
  );
  if (pushTokenResult.json?.token?.id) {
    createdReliability.push({
      kind: "pushToken",
      id: pushTokenResult.json.token.id,
      userId: "demo-customer",
      role: "customer",
      token: pushTokenResult.json.token.token
    });
  }

  const pushDispatchResult = await request(
    "/api/notifications/push-dispatch",
    {
      method: "POST",
      body: JSON.stringify({
        userId: booking.customerId,
        title: "Smoke care update",
        body: "Push delivery route validated.",
        data: {
          bookingId: booking.id,
          link: "/"
        }
      })
    },
    adminCookie
  );
  expect(pushDispatchResult.response.ok, "admin can dispatch push update", pushDispatchResult.text);
  if (pushDispatchResult.json?.dispatch?.id) {
    createdReliability.push({
      kind: "pushDispatch",
      id: pushDispatchResult.json.dispatch.id,
      userId: booking.customerId
    });
  }

  const partnerSeedResult = await request(
    "/api/partners",
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(partnerSeedResult.response.ok, "admin can seed partner marketplace", partnerSeedResult.text);
  for (const partner of partnerSeedResult.json?.partners || []) {
    createdReliability.push({
      kind: "partner",
      id: partner.id,
      type: partner.type,
      zone: partner.zone
    });
  }

  const partnerDispatchResult = await request(
    "/api/partners/dispatch",
    {
      method: "POST",
      body: JSON.stringify({
        partnerType: "ambulance",
        bookingId: booking.id,
        zone: "Central",
        reason: "Smoke emergency partner dispatch"
      })
    },
    adminCookie
  );
  expect(
    partnerDispatchResult.response.ok,
    "admin can dispatch marketplace partner",
    partnerDispatchResult.text
  );
  if (partnerDispatchResult.json?.dispatch?.id) {
    createdReliability.push({
      kind: "partnerDispatch",
      id: partnerDispatchResult.json.dispatch.id,
      partnerId: partnerDispatchResult.json.dispatch.partnerId,
      partnerType: "ambulance"
    });
  }

  const assignResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/assign`,
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(assignResult.response.ok, "admin can assign caretaker", assignResult.text);
  expect(
    assignResult.json?.booking?.caretakerId === "demo-caretaker",
    "assignment selected smoke caretaker"
  );

  const caregiverIntelResult = await request(
    "/api/ops/caregiver-intelligence",
    {},
    adminCookie
  );
  expect(
    caregiverIntelResult.response.ok,
    "admin can read caregiver reliability intelligence",
    caregiverIntelResult.text
  );
  expect(
    caregiverIntelResult.json?.snapshot?.averageReliability >= 0,
    "caregiver intelligence returns reliability score"
  );
  expect(
    Array.isArray(caregiverIntelResult.json?.snapshot?.dispatchRecommendations),
    "caregiver intelligence returns dispatch recommendations"
  );
  expect(
    Array.isArray(caregiverIntelResult.json?.snapshot?.conflicts),
    "caregiver intelligence returns dispatch conflict list"
  );
  expect(
    typeof caregiverIntelResult.json?.snapshot?.delayedAssignments === "number",
    "caregiver intelligence returns delayed assignment count"
  );

  const reassignmentBooking = buildSmokeBooking("-reassign");
  const createReassignmentResult = await request(
    "/api/bookings",
    {
      method: "POST",
      body: JSON.stringify({ booking: reassignmentBooking })
    },
    customerCookie
  );
  createdPaths.push(reassignmentBooking);
  expect(
    createReassignmentResult.response.ok,
    "customer can create reassignment smoke booking",
    createReassignmentResult.text
  );

  const assignReassignmentResult = await request(
    `/api/bookings/${encodeURIComponent(reassignmentBooking.id)}/assign`,
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(
    assignReassignmentResult.response.ok,
    "admin can assign reassignment smoke booking",
    assignReassignmentResult.text
  );
  const originallyAssignedCaretaker =
    assignReassignmentResult.json?.booking?.caretakerId || "";

  const reassignResult = await request(
    `/api/bookings/${encodeURIComponent(reassignmentBooking.id)}/reassign`,
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(reassignResult.response.ok, "admin can reassign backup caregiver", reassignResult.text);
  expect(
    Boolean(reassignResult.json?.booking?.caretakerId) &&
      reassignResult.json.booking.caretakerId !== originallyAssignedCaretaker,
    "reassignment selects a different backup caregiver"
  );
  const commandEscalateBookingResult = await request(
    "/api/ops/emergency-command",
    {
      method: "POST",
      body: JSON.stringify({
        action: "escalate_booking",
        targetType: "booking",
        targetId: reassignmentBooking.id,
        note: "Smoke command center booking escalation"
      })
    },
    adminCookie
  );
  expect(
    commandEscalateBookingResult.response.ok,
    "admin can escalate booking from command center",
    commandEscalateBookingResult.text
  );
  if (commandEscalateBookingResult.json?.action?.id) {
    createdReliability.push({
      kind: "commandAction",
      id: commandEscalateBookingResult.json.action.id,
      targetType: "booking",
      targetId: reassignmentBooking.id
    });
    const generatedAlertId = String(commandEscalateBookingResult.json.action.note || "").match(
      /alert:(ops-alert-[\w-]+)/
    )?.[1];
    if (generatedAlertId) {
      createdReliability.push({
        kind: "opsAlert",
        id: generatedAlertId,
        alertKind: "sla_breach",
        severity: "critical"
      });
    }
  }

  const emergencyCommandResult = await request(
    "/api/ops/emergency-command",
    {},
    adminCookie
  );
  expect(
    emergencyCommandResult.response.ok,
    "admin can read emergency command center",
    emergencyCommandResult.text
  );
  expect(
    ["green", "amber", "red"].includes(emergencyCommandResult.json?.snapshot?.commandLevel),
    "emergency command center returns command level"
  );
  expect(
    Array.isArray(emergencyCommandResult.json?.snapshot?.queues?.command),
    "emergency command center returns unified command queue"
  );
  expect(
    Array.isArray(emergencyCommandResult.json?.snapshot?.queues?.delayedBookings),
    "emergency command center returns delayed booking queue"
  );
  expect(
    typeof emergencyCommandResult.json?.snapshot?.panicCount === "number",
    "emergency command center returns panic queue count"
  );

  const reassuranceResult = await request(
    "/api/ai/reassurance",
    {
      method: "POST",
      body: JSON.stringify({
        userId: booking.customerId,
        bookingId: booking.id,
        serviceType: booking.serviceType,
        recipientName: "Smoke Mom"
      })
    },
    customerCookie
  );
  expect(
    reassuranceResult.response.ok,
    "customer can generate free AI reassurance",
    reassuranceResult.text
  );
  expect(
    Boolean(reassuranceResult.json?.insight?.emotionalMessage),
    "AI reassurance returns family message"
  );
  if (reassuranceResult.json?.insight?.id) {
    createdReliability.push({
      kind: "aiReassurance",
      id: reassuranceResult.json.insight.id,
      userId: booking.customerId,
      bookingId: booking.id
    });
  }

  const retentionResult = await request(
    "/api/retention/summary",
    {
      method: "POST",
      body: JSON.stringify({
        recipientName: "Smoke Mom"
      })
    },
    customerCookie
  );
  expect(
    retentionResult.response.ok,
    "customer can generate retention summary",
    retentionResult.text
  );
  expect(
    typeof retentionResult.json?.summary?.retentionScore === "number",
    "retention summary includes continuity score"
  );
  expect(
    Array.isArray(retentionResult.json?.summary?.actions),
    "retention summary includes recommended actions"
  );
  if (retentionResult.json?.summary?.id) {
    createdReliability.push({
      kind: "retentionSummary",
      id: retentionResult.json.summary.id,
      userId: booking.customerId
    });
  }

  const invoiceResult = await request(
    "/api/finance/invoice",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        billTo: "Smoke Customer Family",
        gstin: "29ABCDE1234F1Z5"
      })
    },
    customerCookie
  );
  expect(invoiceResult.response.ok, "customer can generate GST invoice", invoiceResult.text);
  expect(
    invoiceResult.json?.invoice?.gstAmount >= 0,
    "invoice includes GST amount"
  );
  if (invoiceResult.json?.invoice?.id) {
    createdReliability.push({
      kind: "invoice",
      id: invoiceResult.json.invoice.id,
      bookingId: booking.id,
      userId: booking.customerId
    });
  }

  const payoutResult = await request(
    "/api/finance/payout",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        caretakerId: "demo-caretaker",
        incentiveAmount: 100
      })
    },
    adminCookie
  );
  expect(payoutResult.response.ok, "admin can create caregiver payout", payoutResult.text);
  if (payoutResult.json?.payout?.id) {
    createdReliability.push({
      kind: "payout",
      id: payoutResult.json.payout.id,
      caretakerId: "demo-caretaker",
      bookingId: booking.id
    });
  }

  const subscriptionResult = await request(
    "/api/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        userId: booking.customerId,
        recipientName: "Smoke Mom",
        packageId: "nriCare",
        cadence: "monthly",
        serviceTypes: ["Weekly wellness check", "Medicine reminder"],
        amountLabel: "Rs 6,999 / month"
      })
    },
    adminCookie
  );
  expect(subscriptionResult.response.ok, "admin can create recurring care subscription", subscriptionResult.text);
  if (subscriptionResult.json?.subscription?.id) {
    createdReliability.push({
      kind: "subscription",
      id: subscriptionResult.json.subscription.id,
      userId: booking.customerId
    });
  }

  const medicationScheduleResult = await request(
    "/api/care-quality/medication",
    {
      method: "POST",
      body: JSON.stringify({
        action: "schedule",
        recipientName: "Smoke Mom",
        medicines: [
          {
            name: "BP tablet",
            dosage: "1 tablet",
            time: "9 PM",
            instructions: "After dinner"
          }
        ]
      })
    },
    customerCookie
  );
  expect(
    medicationScheduleResult.response.ok,
    "customer can create medication schedule",
    medicationScheduleResult.text
  );
  if (medicationScheduleResult.json?.schedule?.id) {
    createdReliability.push({
      kind: "medicationSchedule",
      id: medicationScheduleResult.json.schedule.id,
      userId: booking.customerId
    });
  }

  const medicationAdherenceResult = await request(
    "/api/care-quality/medication",
    {
      method: "POST",
      body: JSON.stringify({
        action: "adherence",
        userId: booking.customerId,
        scheduleId: medicationScheduleResult.json?.schedule?.id,
        medicineName: "BP tablet",
        status: "completed",
        note: "Smoke adherence workflow validation",
        bookingId: booking.id
      })
    },
    caretakerCookie
  );
  expect(
    medicationAdherenceResult.response.ok,
    "caretaker can record medication adherence",
    medicationAdherenceResult.text
  );
  if (medicationAdherenceResult.json?.adherence?.id) {
    createdReliability.push({
      kind: "medicationAdherence",
      id: medicationAdherenceResult.json.adherence.id,
      userId: booking.customerId,
      bookingId: booking.id
    });
  }

  const careRiskResult = await request(
    `/api/care-risk/summary?userId=${encodeURIComponent(booking.customerId)}&relationship=Mom`,
    {},
    adminCookie
  );
  expect(careRiskResult.response.ok, "admin can read care risk summary", careRiskResult.text);
  expect(
    typeof careRiskResult.json?.summary?.riskScore === "number",
    "care risk summary includes risk score"
  );
  expect(
    typeof careRiskResult.json?.summary?.emergencyReadinessScore === "number",
    "care risk summary includes emergency readiness score"
  );
  expect(
    Array.isArray(careRiskResult.json?.summary?.recommendations),
    "care risk summary includes recommendations"
  );
  createdReliability.push({
    kind: "careRisk",
    userId: booking.customerId
  });

  const aiOpsSummaryResult = await request(
    "/api/ai/ops-summary",
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(
    aiOpsSummaryResult.response.ok,
    "admin can generate AI ops summary",
    aiOpsSummaryResult.text
  );
  expect(
    Boolean(aiOpsSummaryResult.json?.summary?.headline),
    "AI ops summary includes headline"
  );
  expect(
    Array.isArray(aiOpsSummaryResult.json?.summary?.anomalySignals),
    "AI ops summary includes anomaly signals"
  );
  if (aiOpsSummaryResult.json?.summary?.id) {
    createdReliability.push({
      kind: "aiOpsSummary",
      id: aiOpsSummaryResult.json.summary.id
    });
  }

  const noteCleanupResult = await request(
    "/api/ai/caregiver-note",
    {
      method: "POST",
      body: JSON.stringify({
        rawNote: "Mom felt dizzy in the morning but medicine was completed on time.",
        serviceType: booking.serviceType,
        recipientName: "Smoke Mom"
      })
    },
    caretakerCookie
  );
  expect(
    noteCleanupResult.response.ok,
    "caretaker can clean caregiver note with AI",
    noteCleanupResult.text
  );
  expect(
    Boolean(noteCleanupResult.json?.note?.familyMessage),
    "AI caregiver note includes family message"
  );
  expect(
    Array.isArray(noteCleanupResult.json?.note?.riskTags),
    "AI caregiver note includes risk tags"
  );
  if (noteCleanupResult.json?.note?.id) {
    createdReliability.push({
      kind: "aiCaregiverNote",
      id: noteCleanupResult.json.note.id
    });
  }

  const incidentResult = await request(
    "/api/care-quality/incident",
    {
      method: "POST",
      body: JSON.stringify({
        userId: booking.customerId,
        caretakerId: "demo-caretaker",
        bookingId: booking.id,
        severity: "medium",
        category: "safety",
        summary: "Smoke incident workflow validation"
      })
    },
    caretakerCookie
  );
  expect(incidentResult.response.ok, "caretaker can report care incident", incidentResult.text);
  if (incidentResult.json?.incident?.id) {
    createdReliability.push({
      kind: "incident",
      id: incidentResult.json.incident.id,
      userId: booking.customerId,
      bookingId: booking.id,
      severity: "medium"
    });
    const incidentResolveResult = await request(
      "/api/ops/emergency-command",
      {
        method: "POST",
        body: JSON.stringify({
          action: "resolve_incident",
          targetType: "incident",
          targetId: incidentResult.json.incident.id,
          note: "Smoke command center incident resolution"
        })
      },
      adminCookie
    );
    expect(
      incidentResolveResult.response.ok,
      "admin can resolve incident from command center",
      incidentResolveResult.text
    );
    if (incidentResolveResult.json?.action?.id) {
      createdReliability.push({
        kind: "commandAction",
        id: incidentResolveResult.json.action.id,
        targetType: "incident",
        targetId: incidentResult.json.incident.id
      });
    }
  }

  const trainingBadgeResult = await request(
    "/api/caretaker/training",
    {
      method: "POST",
      body: JSON.stringify({
        caretakerId: "demo-caretaker",
        badgeId: "elder-safety-smoke",
        title: "Elder Safety Training"
      })
    },
    adminCookie
  );
  expect(
    trainingBadgeResult.response.ok,
    "admin can award caretaker training badge",
    trainingBadgeResult.text
  );
  if (trainingBadgeResult.json?.badge?.badgeId) {
    createdReliability.push({
      kind: "trainingBadge",
      caretakerId: "demo-caretaker",
      badgeId: trainingBadgeResult.json.badge.badgeId
    });
  }

  const complaintResult = await request(
    "/api/support/complaints",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        userId: booking.customerId,
        caretakerId: "demo-caretaker",
        type: "delay",
        severity: "medium",
        summary: "Smoke complaint workflow validation"
      })
    },
    customerCookie
  );
  expect(complaintResult.response.ok, "customer can create complaint", complaintResult.text);
  if (complaintResult.json?.complaint?.id) {
    createdReliability.push({
      kind: "complaint",
      id: complaintResult.json.complaint.id,
      bookingId: booking.id,
      userId: booking.customerId,
      severity: "medium"
    });
  }

  if (complaintResult.json?.complaint?.id) {
    const complaintStatusResult = await request(
      `/api/support/complaints/${encodeURIComponent(complaintResult.json.complaint.id)}/status`,
      {
        method: "POST",
        body: JSON.stringify({
          status: "resolved",
          note: "Smoke complaint resolved by ops"
        })
      },
      adminCookie
    );
    expect(
      complaintStatusResult.response.ok,
      "admin can update complaint lifecycle",
      complaintStatusResult.text
    );
  }

  const lifecycleNotificationResult = await request(
    "/api/notifications/lifecycle",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        userId: booking.customerId,
        title: "Smoke lifecycle update",
        body: "Care update reached the family.",
        priority: "normal"
      })
    },
    adminCookie
  );
  expect(
    lifecycleNotificationResult.response.ok,
    "ops can broadcast lifecycle notification",
    lifecycleNotificationResult.text
  );

  const kpiResult = await request("/api/ops/kpis", {}, adminCookie);
  expect(kpiResult.response.ok, "admin can read ops KPIs", kpiResult.text);
  expect(
    typeof kpiResult.json?.kpis?.activeBookings === "number",
    "ops KPIs include active bookings"
  );
  expect(
    typeof kpiResult.json?.kpis?.shiftAnalytics?.activeShifts === "number",
    "ops KPIs include shift analytics"
  );
  expect(
    typeof kpiResult.json?.kpis?.slaAnalytics?.healthyRate === "number",
    "ops KPIs include SLA analytics"
  );

  const snapshotResult = await request(
    "/api/monitoring/snapshot",
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(snapshotResult.response.ok, "admin can write monitoring snapshot", snapshotResult.text);

  const opsAlertResult = await request(
    "/api/ops/alerts",
    {
      method: "POST",
      body: JSON.stringify({
        kind: "sla_breach",
        severity: "high",
        bookingId: booking.id,
        title: "Smoke SLA alert",
        message: "Smoke test validated internal ops escalation."
      })
    },
    adminCookie
  );
  expect(opsAlertResult.response.ok, "admin can create internal ops alert", opsAlertResult.text);
  if (opsAlertResult.json?.alert?.id) {
    createdReliability.push({
      kind: "opsAlert",
      id: opsAlertResult.json.alert.id,
      alertKind: "sla_breach",
      severity: "high"
    });
  }

  const emergencyResult = await request(
    "/api/emergency/escalate",
    {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        userId: booking.customerId,
        bookingId: booking.id,
        reason: "Smoke emergency escalation",
        locationLabel: "Smoke care address",
        severity: "critical"
      })
    },
    adminCookie
  );
  expect(
    emergencyResult.response.ok,
    "admin can create emergency escalation",
    emergencyResult.text
  );
  const emergencyId = emergencyResult.json?.escalation?.id;
  if (emergencyId) {
    createdReliability.push({
      kind: "emergency",
      id: emergencyId,
      userId: booking.customerId,
      severity: "critical"
    });
  }

  const emergencyAdvanceResult = await request(
    "/api/emergency/escalate",
    {
      method: "POST",
      body: JSON.stringify({
        action: "advance",
        escalationId: emergencyId,
        stage: "customer",
        note: "Customer contacted during smoke test"
      })
    },
    adminCookie
  );
  expect(
    emergencyAdvanceResult.response.ok,
    "admin can advance emergency escalation",
    emergencyAdvanceResult.text
  );

  const availabilityResult = await request(
    "/api/caretaker/availability",
    {
      method: "POST",
      body: JSON.stringify({ available: true, status: "standby" })
    },
    caretakerCookie
  );
  expect(
    availabilityResult.response.ok,
    "caretaker can update availability",
    availabilityResult.text
  );

  const attendanceCheckInResult = await request(
    "/api/caretaker/attendance",
    {
      method: "POST",
      body: JSON.stringify({
        action: "check_in",
        lat: 12.974,
        lng: 77.598,
        note: "Smoke shift check-in"
      })
    },
    caretakerCookie
  );
  expect(
    attendanceCheckInResult.response.ok,
    "caretaker can check in for shift",
    attendanceCheckInResult.text
  );
  const smokeShiftId = attendanceCheckInResult.json?.shift?.id;
  if (smokeShiftId) {
    createdReliability.push({
      kind: "attendance",
      id: smokeShiftId,
      caretakerId: "demo-caretaker",
      dateKey: new Date().toISOString().slice(0, 10)
    });
  }

  const acceptResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status: "accepted" })
    },
    caretakerCookie
  );
  expect(acceptResult.response.ok, "caretaker can accept assigned booking", acceptResult.text);

  const enRouteResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status: "en_route" })
    },
    caretakerCookie
  );
  expect(enRouteResult.response.ok, "caretaker can mark en route", enRouteResult.text);

  const locationResult = await request(
    "/api/caretaker/location",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        lat: 12.974,
        lng: 77.598,
        accuracyMeters: 25
      })
    },
    caretakerCookie
  );
  expect(locationResult.response.ok, "caretaker can update live location", locationResult.text);

  const arrivedResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status: "arrived" })
    },
    caretakerCookie
  );
  expect(arrivedResult.response.ok, "caretaker can mark arrived", arrivedResult.text);

  const progressResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status: "in_progress" })
    },
    caretakerCookie
  );
  expect(progressResult.response.ok, "caretaker can start session", progressResult.text);

  const completeResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status: "completed" })
    },
    caretakerCookie
  );
  expect(completeResult.response.ok, "caretaker can complete session", completeResult.text);

  const ratingResult = await request(
    `/api/bookings/${encodeURIComponent(booking.id)}/rating`,
    {
      method: "POST",
      body: JSON.stringify({ score: 5, note: "Smoke visit completed well" })
    },
    customerCookie
  );
  expect(ratingResult.response.ok, "customer can rate completed care", ratingResult.text);

  const trustProfileResult = await request(
    `/api/trust/caregiver/${encodeURIComponent("demo-caretaker")}`,
    {},
    customerCookie
  );
  expect(
    trustProfileResult.response.ok,
    "customer can read caregiver trust profile",
    trustProfileResult.text
  );
  expect(
    trustProfileResult.json?.profile?.trustScore >= 0,
    "caregiver trust profile includes trust score"
  );

  const reportId = `smoke-report-${Date.now()}`;
  await database.ref().update({
    [`reports/byId/${reportId}`]: {
      id: reportId,
      userId: booking.customerId,
      bookingId: booking.id,
      caretakerName: "Smoke Caretaker",
      serviceType: booking.serviceType,
      visitType: "booking",
      reportType: "doctor_visit",
      summary: "Smoke doctor visit report",
      vitalsSummary: "Vitals stable",
      medicineSummary: "Medicine not required",
      familySummary: "Family report access smoke validation",
      caregiverNote: "Report grant validated",
      attachments: [],
      completedAt: Date.now()
    },
    [`reports/byUser/${booking.customerId}/${reportId}`]: {
      id: reportId,
      userId: booking.customerId,
      bookingId: booking.id,
      caretakerName: "Smoke Caretaker",
      serviceType: booking.serviceType,
      visitType: "booking",
      reportType: "doctor_visit",
      summary: "Smoke doctor visit report",
      vitalsSummary: "Vitals stable",
      medicineSummary: "Medicine not required",
      familySummary: "Family report access smoke validation",
      caregiverNote: "Report grant validated",
      attachments: [],
      completedAt: Date.now()
    }
  });
  createdReliability.push({
    kind: "report",
    id: reportId,
    userId: booking.customerId
  });

  const visitProofResult = await request(
    `/api/reports/visit-proof?bookingId=${encodeURIComponent(booking.id)}`,
    {},
    customerCookie
  );
  expect(visitProofResult.response.ok, "customer can read visit proof", visitProofResult.text);
  expect(
    visitProofResult.json?.proof?.reportReady === true,
    "visit proof links completed report"
  );
  expect(
    Array.isArray(visitProofResult.json?.proof?.proofSignals),
    "visit proof includes service proof signals"
  );

  const familyAccessResult = await request(
    "/api/reports/family-access",
    {
      method: "POST",
      body: JSON.stringify({
        familyMemberId,
        reportId,
        permissions: ["monitor", "alerts"]
      })
    },
    customerCookie
  );
  expect(
    familyAccessResult.response.ok,
    "customer can grant family report access",
    familyAccessResult.text
  );
  if (familyAccessResult.json?.grant?.familyMemberId) {
    createdReliability.push({
      kind: "reportAccess",
      id: reportId,
      userId: booking.customerId,
      familyMemberId
    });
  }

  const aiSummaryResult = await request(
    "/api/reports/ai-summary",
    {
      method: "POST",
      body: JSON.stringify({
        reportId
      })
    },
    adminCookie
  );
  expect(aiSummaryResult.response.ok, "admin can generate AI report summary", aiSummaryResult.text);
  expect(
    Boolean(aiSummaryResult.json?.summary?.nextBestAction),
    "AI report summary includes next best action"
  );
  if (aiSummaryResult.json?.summary?.id) {
    createdReliability.push({
      kind: "aiSummary",
      reportId,
      userId: booking.customerId
    });
  }

  const monthlyReportResult = await request(
    "/api/reports/monthly",
    {
      method: "POST",
      body: JSON.stringify({
        userId: booking.customerId,
        month: new Date().toISOString().slice(0, 7)
      })
    },
    adminCookie
  );
  expect(
    monthlyReportResult.response.ok,
    "admin can generate monthly NRI report",
    monthlyReportResult.text
  );
  expect(
    typeof monthlyReportResult.json?.monthlyReport?.totalVisits === "number",
    "monthly report includes visit count"
  );
  expect(
    Boolean(monthlyReportResult.json?.monthlyReport?.aiNarrative),
    "monthly report includes AI narrative"
  );
  expect(
    Array.isArray(monthlyReportResult.json?.monthlyReport?.anomalySignals),
    "monthly report includes anomaly signals"
  );
  if (monthlyReportResult.json?.monthlyReport?.id) {
    createdReliability.push({
      kind: "monthlyReport",
      id: monthlyReportResult.json.monthlyReport.id,
      userId: booking.customerId,
      month: monthlyReportResult.json.monthlyReport.month
    });
  }

  const voiceResult = await request(
    "/api/voice-notes/upload-url",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        userId: booking.customerId,
        contentType: "audio/webm"
      })
    },
    caretakerCookie
  );
  expect(voiceResult.response.ok, "caretaker can create voice-note upload URL", voiceResult.text);

  const kycResult = await request(
    "/api/caretaker/kyc/upload-url",
    {
      method: "POST",
      body: JSON.stringify({
        documentType: "aadhaar",
        contentType: "application/pdf"
      })
    },
    caretakerCookie
  );
  expect(kycResult.response.ok, "caretaker can create Aadhaar KYC upload URL", kycResult.text);

  const kycReviewResult = await request(
    "/api/caretaker/kyc/review",
    {
      method: "POST",
      body: JSON.stringify({
        caretakerId: "demo-caretaker",
        documentType: "aadhaar",
        status: "approved",
        note: "Smoke KYC approval"
      })
    },
    adminCookie
  );
  expect(kycReviewResult.response.ok, "admin can review caretaker KYC", kycReviewResult.text);

  const geoResult = await request(
    "/api/locations/geocode",
    {
      method: "POST",
      body: JSON.stringify({ address: "Jayanagar Bengaluru" })
    },
    customerCookie
  );
  expect(geoResult.response.ok, "signed customer can geocode address", geoResult.text);
  expect(Boolean(geoResult.json?.location?.zone), "geocode returns dispatch zone");

  const logoutAllResult = await request(
    "/api/auth/logout-all",
    {
      method: "POST",
      body: JSON.stringify({})
    },
    caretakerCookie
  );
  expect(logoutAllResult.response.ok, "caretaker can logout all devices", logoutAllResult.text);

  const attendanceCheckOutResult = await request(
    "/api/caretaker/attendance",
    {
      method: "POST",
      body: JSON.stringify({
        caretakerId: "demo-caretaker",
        action: "check_out",
        note: "Smoke shift check-out"
      })
    },
    adminCookie
  );
  expect(
    attendanceCheckOutResult.response.ok,
    "admin can record caretaker shift checkout",
    attendanceCheckOutResult.text
  );

  const revokedVoiceResult = await request(
    "/api/voice-notes/upload-url",
    {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking.id,
        userId: booking.customerId,
        contentType: "audio/webm"
      })
    },
    caretakerCookie
  );
  expect(
    revokedVoiceResult.response.status === 401,
    "revoked caretaker session is rejected",
    revokedVoiceResult.text
  );
} catch (error) {
  fail("smoke test crashed", error instanceof Error ? error.message : String(error));
} finally {
  for (const item of createdReliability) {
    if (item.kind === "ticket") {
      await database
        .ref()
        .update({
          [`supportTickets/byId/${item.id}`]: null,
          [`supportTickets/byUser/${item.userId}/${item.id}`]: null,
          [`operations/supportQueue/${item.priority}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "complaint") {
      await database
        .ref()
        .update({
          [`complaints/byId/${item.id}`]: null,
          [`complaints/byBooking/${item.bookingId}/${item.id}`]: null,
          [`complaints/byUser/${item.userId}/${item.id}`]: null,
          [`operations/complaintQueue/${item.severity}/${item.id}`]: null,
          [`complaintActions/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "refund") {
      await database
        .ref()
        .update({
          [`refunds/byId/${item.id}`]: null,
          [`refunds/byBooking/${item.bookingId}/${item.id}`]: null,
          [`operations/refundQueue/requested/${item.id}`]: null,
          [`operations/refundQueue/processing/${item.id}`]: null,
          [`operations/refundQueue/processed/${item.id}`]: null,
          [`operations/refundQueue/failed/${item.id}`]: null,
          [`refundActions/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "opsAlert") {
      await database
        .ref()
        .update({
          [`operations/internalAlerts/byId/${item.id}`]: null,
          [`operations/internalAlerts/byKind/${item.alertKind}/${item.id}`]: null,
          [`operations/internalAlerts/bySeverity/${item.severity}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "commandAction") {
      await database
        .ref()
        .update({
          [`operations/commandCenter/actions/${item.id}`]: null,
          [`operations/commandCenter/acknowledged/${item.targetType}/${item.targetId}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "pushToken") {
      await database
        .ref()
        .update({
          [`pushTokens/byUser/${item.userId}/${item.id}`]: null,
          [`pushTokens/byRole/${item.role}/${item.userId}-${item.id}`]: null,
          [`pushTokens/byToken/${String(item.token).replace(/[.#$/[\]]/g, "_")}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "pushDispatch") {
      await database
        .ref()
        .update({
          [`pushDispatches/byId/${item.id}`]: null,
          [`pushDispatches/byUser/${item.userId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "attendance") {
      await database
        .ref()
        .update({
          [`caretakerAttendance/activeShifts/${item.caretakerId}`]: null,
          [`caretakerAttendance/byCaretaker/${item.caretakerId}/${item.id}`]: null,
          [`caretakerAttendance/byDate/${item.dateKey}/${item.caretakerId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "report") {
      await database
        .ref()
        .update({
          [`reports/byId/${item.id}`]: null,
          [`reports/byUser/${item.userId}/${item.id}`]: null,
          [`reports/familyVisible/${item.userId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "reportAccess") {
      await database
        .ref()
        .update({
          [`reportAccess/byFamilyMember/${item.familyMemberId}/${item.id}`]: null,
          [`reportAccess/byCustomer/${item.userId}/${item.familyMemberId}/${item.id}`]: null,
          [`reports/familyVisible/${item.userId}/${item.id}/${item.familyMemberId}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "aiSummary") {
      await database
        .ref()
        .update({
          [`aiSummaries/byReport/${item.reportId}`]: null,
          [`aiSummaries/byUser/${item.userId}/${item.reportId}`]: null,
          [`reports/byId/${item.reportId}/aiSummary`]: null,
          [`reports/byUser/${item.userId}/${item.reportId}/aiSummary`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "aiReassurance") {
      await database
        .ref()
        .update({
          [`aiReassurance/byId/${item.id}`]: null,
          [`aiReassurance/byUser/${item.userId}/${item.id}`]: null,
          [`aiReassurance/byBooking/${item.bookingId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "aiOpsSummary") {
      await database.ref(`aiOpsSummaries/byId/${item.id}`).remove().catch(() => undefined);
    }
    if (item.kind === "aiCaregiverNote") {
      await database.ref(`aiCaregiverNotes/byId/${item.id}`).remove().catch(() => undefined);
    }
    if (item.kind === "retentionSummary") {
      await database
        .ref(`retentionSummaries/byUser/${item.userId}/${item.id}`)
        .remove()
        .catch(() => undefined);
    }
    if (item.kind === "monthlyReport") {
      await database
        .ref()
        .update({
          [`monthlyReports/byId/${item.id}`]: null,
          [`monthlyReports/byUser/${item.userId}/${item.month}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "emergency") {
      await database
        .ref()
        .update({
          [`emergencyEscalations/byId/${item.id}`]: null,
          [`emergencyEscalations/byUser/${item.userId}/${item.id}`]: null,
          [`operations/emergencyQueue/${item.severity}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "partner") {
      await database
        .ref()
        .update({
          [`partners/byId/${item.id}`]: null,
          [`partners/byType/${item.type}/${item.id}`]: null,
          [`partners/byZone/${item.zone}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "partnerDispatch") {
      await database
        .ref()
        .update({
          [`partnerDispatches/byId/${item.id}`]: null,
          [`partnerDispatches/byPartner/${item.partnerId}/${item.id}`]: null,
          [`operations/partnerDispatchQueue/${item.partnerType}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "invoice") {
      await database
        .ref()
        .update({
          [`invoices/byId/${item.id}`]: null,
          [`invoices/byBooking/${item.bookingId}`]: null,
          [`invoices/byUser/${item.userId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "payout") {
      await database
        .ref()
        .update({
          [`payouts/byId/${item.id}`]: null,
          [`payouts/byCaretaker/${item.caretakerId}/${item.id}`]: null,
          [`payouts/byBooking/${item.bookingId}`]: null,
          [`operations/payoutQueue/pending/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "subscription") {
      await database
        .ref()
        .update({
          [`subscriptions/byId/${item.id}`]: null,
          [`subscriptions/byUser/${item.userId}/${item.id}`]: null,
          [`profiles/${item.userId}/activeSubscriptions/${item.id}`]: null,
          [`operations/subscriptionQueue/active/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "medicationSchedule") {
      await database
        .ref()
        .update({
          [`medicationSchedules/byId/${item.id}`]: null,
          [`medicationSchedules/byUser/${item.userId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "medicationAdherence") {
      await database
        .ref()
        .update({
          [`medicationAdherence/byId/${item.id}`]: null,
          [`medicationAdherence/byUser/${item.userId}/${item.id}`]: null,
          [`medicationAdherence/byBooking/${item.bookingId}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "careRisk") {
      await database.ref(`careRisk/byUser/${item.userId}`).remove().catch(() => undefined);
    }
    if (item.kind === "incident") {
      await database
        .ref()
        .update({
          [`incidents/byId/${item.id}`]: null,
          [`incidents/byUser/${item.userId}/${item.id}`]: null,
          [`incidents/byBooking/${item.bookingId}/${item.id}`]: null,
          [`operations/incidentQueue/${item.severity}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "trainingBadge") {
      await database
        .ref()
        .update({
          [`trainingBadges/byCaretaker/${item.caretakerId}/${item.badgeId}`]: null,
          [`trainingBadges/byBadge/${item.badgeId}/${item.caretakerId}`]: null,
          [`caretakers/${item.caretakerId}/trainingBadges/${item.badgeId}`]: null
        })
        .catch(() => undefined);
    }
  }
  for (const booking of createdPaths) {
    await cleanupBooking(booking).catch(() => undefined);
  }
}

const failed = assertions.filter((assertion) => !assertion.ok);

console.log(`\nSmoke assertions: ${assertions.length - failed.length}/${assertions.length} passed`);

if (failed.length) {
  process.exit(1);
}

process.exit(0);
