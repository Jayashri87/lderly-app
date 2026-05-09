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

const buildSmokeBooking = () => {
  const now = Date.now();
  const bookingId = `smoke-booking-${now}`;
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
    city: "Bengaluru",
    zone: "South",
    skills: ["doctor_visit", "lab_support", "medicine_help"],
    languages: ["English", "Hindi"],
    rating: 4.9,
    activeAssignments: 0,
    maxAssignments: 5,
    verified: true,
    trained: true,
    yearsExperience: 5
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
    [`operations/bookingsByCaretaker/demo-caretaker/${booking.id}`]: null
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
    status.json?.productionReadiness?.razorpayConfigured === true,
    "Razorpay order keys configured"
  );
  expect(status.json?.productionReadiness?.pwaManifest === true, "PWA manifest is prepared");
  expect(status.json?.productionReadiness?.legalPages === true, "legal pages are prepared");
  expect(
    status.json?.productionReadiness?.firebaseAppCheckPrepared === true,
    "Firebase App Check is scaffolded"
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

  const snapshotResult = await request(
    "/api/monitoring/snapshot",
    {
      method: "POST",
      body: JSON.stringify({})
    },
    adminCookie
  );
  expect(snapshotResult.response.ok, "admin can write monitoring snapshot", snapshotResult.text);

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
          [`operations/complaintQueue/${item.severity}/${item.id}`]: null
        })
        .catch(() => undefined);
    }
    if (item.kind === "refund") {
      await database
        .ref()
        .update({
          [`refunds/byId/${item.id}`]: null,
          [`refunds/byBooking/${item.bookingId}/${item.id}`]: null,
          [`operations/refundQueue/requested/${item.id}`]: null
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
