import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const baseUrl = process.env.CARE_FLOW_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:3210";

const loadEnvFile = (fileName) => {
  const filePath = join(root, fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^"|"$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const credentialsFor = (role) => {
  const prefix = `LDERLY_${role.toUpperCase()}`;
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];

  if (!username || !password) {
    throw new Error(`${prefix}_USERNAME and ${prefix}_PASSWORD are required`);
  }

  return { username, password };
};

const cookieFrom = (setCookie = "") => {
  const match = setCookie.match(/lderly_session=[^;]+/);

  if (!match) {
    throw new Error("Auth response did not include lderly_session cookie");
  }

  return match[0];
};

const request = async (path, options = {}, cookie = "") => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json?.error || text}`);
  }

  return { response, json };
};

const login = async (role) => {
  const response = await fetch(`${baseUrl}/api/auth/${role}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl
    },
    body: JSON.stringify(credentialsFor(role))
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${role} login failed ${response.status}: ${json?.error || text}`);
  }

  return {
    cookie: cookieFrom(response.headers.get("set-cookie") || ""),
    session: json
  };
};

const bookingPayload = () => {
  const timestamp = Date.now();
  const scheduledFor = timestamp + 60 * 60 * 1000;

  return {
    id: `care-flow-${timestamp}`,
    serviceType: "Doctor Visit",
    status: "searching",
    customerId: "demo-customer",
    customerName: "Customer",
    caretakerId: "",
    caretakerName: "Awaiting assignment",
    scheduledFor,
    notes: "Care-flow verification booking",
    createdAt: timestamp,
    updatedAt: timestamp,
    requestDetails: {
      careFor: {
        relationship: "Mother",
        displayName: "Mom"
      },
      careNeed: "Health-related assistance",
      service: "Doctor Visit",
      duration: {
        label: "1 Hour",
        price: "Rs 499",
        note: "Care-flow verification"
      },
      schedule: {
        label: "Now",
        detail: "Next available caregiver",
        requestedFor: scheduledFor
      },
      location: {
        label: "Saved care address",
        detail: "Bengaluru care location"
      },
      pricing: {
        careEstimate: "Rs 499",
        coordinationFee: "Included",
        estimatedTotal: "Rs 499"
      },
      trust: ["Verified caregivers", "Family updates included"]
    },
    lifecycle: {
      allowedNextStatuses: ["assigned", "cancelled"],
      currentStep: "Finding Caregiver",
      nextStep: "Caregiver Assigned",
      lastActor: "customer"
    },
    matching: {
      requiredSkills: ["doctor_visit"],
      preferredLanguages: ["English", "Hindi"],
      city: "Bengaluru",
      zone: "Central",
      priority: "urgent",
      preferredCaretakerId: "",
      assignmentCapacityRequired: 1
    },
    scheduleIndex: {
      dateKey: new Date(scheduledFor).toISOString().slice(0, 10),
      hourKey: new Date(scheduledFor).toISOString().slice(0, 13),
      statusKey: "searching",
      city: "Bengaluru",
      zone: "Central"
    },
    payment: {
      estimatedTotal: "Rs 499",
      careEstimate: "Rs 499",
      coordinationFee: "Included",
      method: "pending",
      status: "pending",
      invoiceId: ""
    },
    familyUpdates: {
      inApp: "queued",
      whatsapp: "queued",
      sms: "pending",
      voiceNote: "not_requested",
      recipients: ["demo-customer"]
    },
    serviceReport: {
      reportType: "doctor_visit",
      requiredSections: ["Appointment details", "Doctor notes", "Prescription", "Follow-up"],
      uploadSlots: ["Prescription", "Clinic bill"]
    },
    completion: {
      paymentReleaseStatus: "not_ready"
    },
    tracking: {
      etaMinutes: 12,
      distanceKm: 3.2,
      destinationLabel: "Saved care address",
      customerLocation: { lat: 12.9716, lng: 77.5946 },
      caretakerLocation: { lat: 12.985, lng: 77.61 },
      lastLocationAt: timestamp,
      routeStatus: "pending"
    },
    sla: {
      assignmentDueAt: timestamp + 10 * 60 * 1000,
      arrivalDueAt: scheduledFor + 20 * 60 * 1000,
      status: "healthy",
      breachReason: ""
    },
    timeline: [{ label: "Doctor Visit sent to nearby caregivers", at: timestamp }]
  };
};

const rejectionBookingPayload = () => ({
  ...bookingPayload(),
  id: `care-flow-reject-${Date.now()}`
});

const expectStatus = (booking, status, label) => {
  if (booking.status !== status) {
    throw new Error(`${label}: expected ${status}, received ${booking.status}`);
  }
};

const main = async () => {
  const customer = await login("customer");
  const caretaker = await login("caretaker");

  const createResult = await request(
    "/api/bookings",
    {
      method: "POST",
      body: JSON.stringify({ booking: bookingPayload() })
    },
    customer.cookie
  );
  let booking = createResult.json.booking;

  if (!booking?.dispatch?.offers?.["demo-caretaker"]) {
    throw new Error("Booking was not broadcast to demo-caretaker");
  }

  await request(
    "/api/payments/checkout",
    {
      method: "POST",
      body: JSON.stringify({ bookingId: booking.id })
    },
    customer.cookie
  );

  const caretakerRead = await request(
    `/api/bookings?bookingId=${encodeURIComponent(booking.id)}`,
    { method: "GET" },
    caretaker.cookie
  );
  if (!caretakerRead.json.booking?.dispatch?.offers?.["demo-caretaker"]) {
    throw new Error("Caretaker could not read their dispatch offer");
  }

  const rejectionCreateResult = await request(
    "/api/bookings",
    {
      method: "POST",
      body: JSON.stringify({ booking: rejectionBookingPayload() })
    },
    customer.cookie
  );
  const rejectedBooking = (
    await request(
      `/api/bookings/${encodeURIComponent(rejectionCreateResult.json.booking.id)}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason: "Care-flow rejection coverage" })
      },
      caretaker.cookie
    )
  ).json.booking;

  if (rejectedBooking.dispatch?.offers?.["demo-caretaker"]?.status !== "rejected") {
    throw new Error("Caretaker rejection did not update the dispatch offer");
  }

  if (rejectedBooking.status === "cancelled" || rejectedBooking.status === "completed") {
    throw new Error(`Rejected offer moved customer booking to invalid status: ${rejectedBooking.status}`);
  }

  booking = (
    await request(
      `/api/bookings/${encodeURIComponent(booking.id)}/accept`,
      { method: "POST", body: JSON.stringify({}) },
      caretaker.cookie
    )
  ).json.booking;
  expectStatus(booking, "accepted", "accept");

  booking = (
    await request(
      `/api/bookings/${encodeURIComponent(booking.id)}/status`,
      { method: "POST", body: JSON.stringify({ status: "en_route" }) },
      caretaker.cookie
    )
  ).json.booking;
  expectStatus(booking, "en_route", "en route");

  booking = (
    await request(
      `/api/bookings/${encodeURIComponent(booking.id)}/status`,
      { method: "POST", body: JSON.stringify({ status: "arrived" }) },
      caretaker.cookie
    )
  ).json.booking;
  expectStatus(booking, "arrived", "arrived");

  booking = (
    await request(
      `/api/bookings/${encodeURIComponent(booking.id)}/start`,
      { method: "POST", body: JSON.stringify({ otp: booking.serviceStart?.otp }) },
      caretaker.cookie
    )
  ).json.booking;
  expectStatus(booking, "in_progress", "start with OTP");

  booking = (
    await request(
      `/api/bookings/${encodeURIComponent(booking.id)}/status`,
      { method: "POST", body: JSON.stringify({ status: "completed" }) },
      caretaker.cookie
    )
  ).json.booking;
  expectStatus(booking, "completed", "complete");

  booking = (
    await request(
      `/api/bookings/${encodeURIComponent(booking.id)}/verify-completion`,
      {
        method: "POST",
        body: JSON.stringify({ approved: true, note: "Care-flow verification approved" })
      },
      customer.cookie
    )
  ).json.booking;
  expectStatus(booking, "payment_settled", "customer verification");

  if (booking.completion?.paymentReleaseStatus !== "released") {
    throw new Error("Customer verification did not release payment");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        bookingId: booking.id,
        finalStatus: booking.status,
        paymentReleaseStatus: booking.completion.paymentReleaseStatus
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
