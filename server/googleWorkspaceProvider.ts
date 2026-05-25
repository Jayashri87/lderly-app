import { GoogleAuth } from "google-auth-library";
import type { CareBooking } from "../services/bookingService";
import type { CustomerLead } from "./customerLeadProvider";

type GoogleWorkspaceResult =
  | { ok: true; provider: "google_workspace"; id?: string; url?: string; details?: unknown }
  | { ok: false; provider: "google_workspace"; status: number; error: string };

type MonthlyReportDocument = {
  id: string;
  userId: string;
  month: string;
  totalVisits: number;
  familyHeadline: string;
  aiNarrative: string;
  wellnessSignal: string;
  topNextActions?: string[];
  highlights?: Array<{
    serviceType: string;
    summary: string;
    nextBestAction?: string;
  }>;
};

type OpsSheetName =
  | "Bookings"
  | "Caregiver Dispatch"
  | "Payments"
  | "Escalations"
  | "Feedback"
  | "Reports"
  | "Support Tickets"
  | "Refunds"
  | "Invoices"
  | "Caregiver Attendance"
  | "Care Risk"
  | "Medication"
  | "Payouts"
  | "Subscriptions"
  | "Partner Dispatch"
  | "KYC Reviews"
  | "Push Notifications"
  | "Ops Alerts";

type PaymentSyncEvent = {
  booking: CareBooking;
  event: string;
  provider?: string;
  mode?: string;
  orderId?: string;
  paymentId?: string;
  status?: string;
  amount?: string | number;
  actor?: string;
};

type EscalationSyncEvent = {
  escalationId?: string;
  bookingId?: string;
  userId?: string;
  action: string;
  stage?: string;
  severity?: string;
  reason?: string;
  locationLabel?: string;
  status?: string;
  actor?: string;
  note?: string;
};

type FeedbackSyncEvent = {
  complaintId?: string;
  bookingId: string;
  userId?: string;
  caretakerId?: string;
  type: string;
  severity?: string;
  summary: string;
  status?: string;
  actor?: string;
};

type SupportTicketSyncEvent = {
  ticketId?: string;
  bookingId: string;
  userId?: string;
  category: string;
  priority?: string;
  subject: string;
  description: string;
  status?: string;
  actor?: string;
};

type RefundSyncEvent = {
  refundId?: string;
  bookingId: string;
  userId?: string;
  paymentId?: string;
  amountPaise?: number;
  reason?: string;
  status?: string;
  actor?: string;
};

type InvoiceSyncEvent = {
  invoiceId?: string;
  bookingId: string;
  userId?: string;
  billTo?: string;
  gstin?: string;
  paymentId?: string;
  taxableAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
  status?: string;
  pdfStatus?: string;
};

type AttendanceSyncEvent = {
  shiftId?: string;
  caretakerId: string;
  action: string;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  note?: string;
  status?: string;
  actor?: string;
};

type CareRiskSyncEvent = {
  userId: string;
  recipientName?: string;
  relationship?: string;
  riskScore?: number;
  riskLevel?: string;
  fallRisk?: string;
  medicationRisk?: string;
  vitalsRisk?: string;
  emergencyReadinessScore?: number;
  openIncidents?: number;
  signals?: string[];
  recommendations?: string[];
};

type MedicationSyncEvent = {
  event: "schedule" | "adherence";
  userId: string;
  recipientName?: string;
  scheduleId?: string;
  medicineName?: string;
  medicines?: Array<{ name: string; dosage: string; time: string; instructions?: string }>;
  status?: string;
  note?: string;
  bookingId?: string;
  actor?: string;
};

type PayoutSyncEvent = {
  payoutId?: string;
  bookingId: string;
  caretakerId?: string;
  caretakerName?: string;
  grossAmount?: number;
  basePayout?: number;
  incentiveAmount?: number;
  totalPayout?: number;
  status?: string;
  reconciliationStatus?: string;
  provider?: string;
};

type SubscriptionSyncEvent = {
  subscriptionId?: string;
  userId: string;
  recipientName: string;
  packageId: string;
  cadence: string;
  serviceTypes?: string[];
  amountLabel?: string;
  status?: string;
  nextBillingAt?: number;
  nextVisitWindow?: string;
  actor?: string;
};

type PartnerDispatchSyncEvent = {
  dispatchId?: string;
  bookingId?: string;
  partnerId?: string;
  partnerName?: string;
  partnerType: string;
  zone?: string;
  reason?: string;
  status?: string;
  etaMinutes?: number;
  actor?: string;
};

type KycReviewSyncEvent = {
  caretakerId: string;
  documentType: string;
  status: string;
  reviewerId?: string;
  note?: string;
};

type PushNotificationSyncEvent = {
  dispatchId?: string;
  userId: string;
  title: string;
  body: string;
  status?: string;
  mode?: string;
  attempted?: number;
  sent?: number;
  failed?: number;
  actor?: string;
};

type OpsAlertSyncEvent = {
  alertId?: string;
  kind: string;
  title: string;
  message: string;
  bookingId?: string;
  severity?: string;
  channel?: string;
  status?: string;
};

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents"
];

const hasValue = (value?: string) => Boolean(value && value.trim());

const normalizePrivateKey = (value?: string) =>
  value?.replace(/^"|"$/g, "").replace(/\\n/g, "\n").trim();

const getConfig = () => {
  const clientEmail = process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.GOOGLE_WORKSPACE_PRIVATE_KEY);
  const projectId = process.env.GOOGLE_WORKSPACE_PROJECT_ID?.trim();

  if (!clientEmail || !privateKey || !projectId) {
    return null;
  }

  return { clientEmail, privateKey, projectId };
};

const unavailable = (missing: string): GoogleWorkspaceResult => ({
  ok: false,
  provider: "google_workspace",
  status: 501,
  error: `${missing} is not configured`
});

const accessTokenFor = async () => {
  const config = getConfig();

  if (!config) {
    return null;
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey,
      project_id: config.projectId
    },
    scopes
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  return token.token || null;
};

const googleFetch = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> => {
  let token: string | null = null;

  try {
    token = await accessTokenFor();
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : "Google Workspace auth failed"
    };
  }

  if (!token) {
    return { ok: false, status: 501, error: "Google Workspace credentials are not configured" };
  }

  let response: Response;
  let data: Record<string, unknown>;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Google Workspace request failed"
    };
  }

  if (!response.ok) {
    const googleError = data.error as { message?: string } | string | undefined;
    return {
      ok: false,
      status: response.status,
      error:
        (typeof googleError === "object" ? googleError.message : googleError) ||
        "Google Workspace request failed"
    };
  }

  return { ok: true, data: data as T };
};

const sheetValue = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).slice(0, 500);

const eventDateTime = (timestamp?: number) =>
  new Date(timestamp && Number.isFinite(timestamp) ? timestamp : Date.now()).toISOString();

const eventEndDateTime = (booking: CareBooking) => {
  const duration = booking.requestDetails?.duration?.label || "";
  const hours = duration.toLowerCase().includes("half")
    ? 4
    : duration.toLowerCase().includes("full")
      ? 8
      : duration.toLowerCase().includes("overnight")
        ? 12
        : 1;

  return new Date((booking.scheduledFor || Date.now()) + hours * 60 * 60 * 1000).toISOString();
};

const replaceTokens = (text: string) =>
  Object.entries({
    "{{": "",
    "}}": ""
  }).reduce((result, [from, to]) => result.replaceAll(from, to), text);

const spreadsheetIdForOps = () =>
  process.env.GOOGLE_SHEETS_OPS_SPREADSHEET_ID?.trim() ||
  process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID?.trim();

const appendRows = async (
  sheetName: OpsSheetName,
  rows: unknown[][]
): Promise<GoogleWorkspaceResult> => {
  const spreadsheetId = spreadsheetIdForOps();

  if (!spreadsheetId) {
    return unavailable("GOOGLE_SHEETS_OPS_SPREADSHEET_ID");
  }

  const result = await googleFetch<{
    updates?: { updatedRange?: string };
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`${sheetName}!A:Z`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      body: JSON.stringify({ values: rows.map((row) => row.map(sheetValue)) })
    }
  );

  if (!result.ok) {
    return { ok: false, provider: "google_workspace", status: result.status, error: result.error };
  }

  return {
    ok: true,
    provider: "google_workspace",
    id: result.data.updates?.updatedRange,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    details: { sheetName, updatedRange: result.data.updates?.updatedRange }
  };
};

const bookingOpsRow = (
  booking: CareBooking,
  calendarResult?: GoogleWorkspaceResult
) => [
  new Date().toISOString(),
  booking.id,
  booking.customerId,
  booking.customerName,
  booking.serviceType,
  booking.requestDetails?.careFor?.displayName || "",
  booking.status,
  eventDateTime(booking.scheduledFor),
  booking.scheduleIndex?.zone || booking.matching?.zone || "",
  booking.caretakerName || booking.caretakerId || "",
  booking.payment?.status || "",
  booking.payment?.estimatedTotal || booking.requestDetails?.pricing?.estimatedTotal || "",
  booking.sla?.status || "",
  calendarResult?.ok ? calendarResult.url || calendarResult.id || "" : "",
  booking.notes || ""
];

export const GoogleWorkspaceProvider = {
  isConfigured() {
    return Boolean(getConfig());
  },

  readiness() {
    return {
      configured: Boolean(getConfig()),
      sheetsLeadsConfigured: hasValue(process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID),
      calendarOpsConfigured: hasValue(process.env.GOOGLE_CALENDAR_OPS_CALENDAR_ID),
      driveRootConfigured: hasValue(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID),
      monthlyReportTemplateConfigured: hasValue(process.env.GOOGLE_DOCS_MONTHLY_REPORT_TEMPLATE_ID)
    };
  },

  async appendBookingToOpsSheet(
    booking: CareBooking,
    calendarResult?: GoogleWorkspaceResult
  ): Promise<GoogleWorkspaceResult> {
    return appendRows("Bookings", [bookingOpsRow(booking, calendarResult)]);
  },

  async appendDispatchToOpsSheet(booking: CareBooking): Promise<GoogleWorkspaceResult> {
    const offers = Object.values(booking.dispatch?.offers || {});

    if (!offers.length) {
      return appendRows("Caregiver Dispatch", [
        [
          new Date().toISOString(),
          booking.id,
          "",
          booking.caretakerName || "Nearby caregivers notified",
          booking.dispatch?.status || "manual_review",
          "",
          "",
          "",
          "",
          "",
          booking.dispatch?.status || "",
          booking.dispatch?.candidateCount || 0
        ]
      ]);
    }

    return appendRows(
      "Caregiver Dispatch",
      offers.map((offer) => [
        new Date().toISOString(),
        booking.id,
        offer.caretakerId,
        offer.caretakerName,
        offer.status,
        offer.etaMinutes,
        offer.distanceKm,
        offer.score,
        offer.notifiedAt ? new Date(offer.notifiedAt).toISOString() : "",
        offer.respondedAt ? new Date(offer.respondedAt).toISOString() : "",
        booking.dispatch?.status || "",
        booking.dispatch?.candidateCount || 0
      ])
    );
  },

  async appendPaymentToOpsSheet(event: PaymentSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Payments", [
      [
        new Date().toISOString(),
        event.booking.id,
        event.event,
        event.provider || "",
        event.mode || "",
        event.orderId || "",
        event.paymentId || "",
        event.status || event.booking.payment?.status || "",
        event.amount || event.booking.payment?.estimatedTotal || "",
        event.booking.customerId,
        event.booking.serviceType,
        event.actor || ""
      ]
    ]);
  },

  async appendEscalationToOpsSheet(event: EscalationSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Escalations", [
      [
        new Date().toISOString(),
        event.escalationId || "",
        event.bookingId || "",
        event.userId || "",
        event.action,
        event.stage || "",
        event.severity || "",
        event.reason || "",
        event.locationLabel || "",
        event.status || "",
        event.actor || "",
        event.note || ""
      ]
    ]);
  },

  async appendFeedbackToOpsSheet(event: FeedbackSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Feedback", [
      [
        new Date().toISOString(),
        event.complaintId || "",
        event.bookingId,
        event.userId || "",
        event.caretakerId || "",
        event.type,
        event.severity || "",
        event.summary,
        event.status || "open",
        event.actor || ""
      ]
    ]);
  },

  async appendSupportTicketToOpsSheet(event: SupportTicketSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Support Tickets", [
      [
        new Date().toISOString(),
        event.ticketId || "",
        event.bookingId,
        event.userId || "",
        event.category,
        event.priority || "normal",
        event.subject,
        event.description,
        event.status || "open",
        event.actor || ""
      ]
    ]);
  },

  async appendRefundToOpsSheet(event: RefundSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Refunds", [
      [
        new Date().toISOString(),
        event.refundId || "",
        event.bookingId,
        event.userId || "",
        event.paymentId || "",
        event.amountPaise || 0,
        event.reason || "",
        event.status || "requested",
        event.actor || ""
      ]
    ]);
  },

  async appendInvoiceToOpsSheet(event: InvoiceSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Invoices", [
      [
        new Date().toISOString(),
        event.invoiceId || "",
        event.bookingId,
        event.userId || "",
        event.billTo || "",
        event.gstin || "",
        event.paymentId || "",
        event.taxableAmount || 0,
        event.gstAmount || 0,
        event.totalAmount || 0,
        event.status || "",
        event.pdfStatus || ""
      ]
    ]);
  },

  async appendAttendanceToOpsSheet(event: AttendanceSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Caregiver Attendance", [
      [
        new Date().toISOString(),
        event.shiftId || "",
        event.caretakerId,
        event.action,
        event.status || "",
        event.lat || "",
        event.lng || "",
        event.accuracyMeters || "",
        event.note || "",
        event.actor || ""
      ]
    ]);
  },

  async appendCareRiskToOpsSheet(event: CareRiskSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Care Risk", [
      [
        new Date().toISOString(),
        event.userId,
        event.recipientName || "",
        event.relationship || "",
        event.riskScore || 0,
        event.riskLevel || "",
        event.fallRisk || "",
        event.medicationRisk || "",
        event.vitalsRisk || "",
        event.emergencyReadinessScore || 0,
        event.openIncidents || 0,
        (event.signals || []).join(" | "),
        (event.recommendations || []).join(" | ")
      ]
    ]);
  },

  async appendMedicationToOpsSheet(event: MedicationSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Medication", [
      [
        new Date().toISOString(),
        event.event,
        event.userId,
        event.recipientName || "",
        event.scheduleId || "",
        event.medicineName || (event.medicines || []).map((medicine) => medicine.name).join(" | "),
        (event.medicines || [])
          .map((medicine) => `${medicine.name} ${medicine.dosage} ${medicine.time}`)
          .join(" | "),
        event.status || "",
        event.note || "",
        event.bookingId || "",
        event.actor || ""
      ]
    ]);
  },

  async appendPayoutToOpsSheet(event: PayoutSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Payouts", [
      [
        new Date().toISOString(),
        event.payoutId || "",
        event.bookingId,
        event.caretakerId || "",
        event.caretakerName || "",
        event.grossAmount || 0,
        event.basePayout || 0,
        event.incentiveAmount || 0,
        event.totalPayout || 0,
        event.status || "",
        event.reconciliationStatus || "",
        event.provider || ""
      ]
    ]);
  },

  async appendSubscriptionToOpsSheet(event: SubscriptionSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Subscriptions", [
      [
        new Date().toISOString(),
        event.subscriptionId || "",
        event.userId,
        event.recipientName,
        event.packageId,
        event.cadence,
        (event.serviceTypes || []).join(" | "),
        event.amountLabel || "",
        event.status || "",
        event.nextBillingAt ? new Date(event.nextBillingAt).toISOString() : "",
        event.nextVisitWindow || "",
        event.actor || ""
      ]
    ]);
  },

  async appendPartnerDispatchToOpsSheet(event: PartnerDispatchSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Partner Dispatch", [
      [
        new Date().toISOString(),
        event.dispatchId || "",
        event.bookingId || "",
        event.partnerId || "",
        event.partnerName || "",
        event.partnerType,
        event.zone || "",
        event.reason || "",
        event.status || "",
        event.etaMinutes || "",
        event.actor || ""
      ]
    ]);
  },

  async appendKycReviewToOpsSheet(event: KycReviewSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("KYC Reviews", [
      [
        new Date().toISOString(),
        event.caretakerId,
        event.documentType,
        event.status,
        event.reviewerId || "",
        event.note || ""
      ]
    ]);
  },

  async appendPushNotificationToOpsSheet(event: PushNotificationSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Push Notifications", [
      [
        new Date().toISOString(),
        event.dispatchId || "",
        event.userId,
        event.title,
        event.body,
        event.status || "",
        event.mode || "",
        event.attempted || 0,
        event.sent || 0,
        event.failed || 0,
        event.actor || ""
      ]
    ]);
  },

  async appendOpsAlertToOpsSheet(event: OpsAlertSyncEvent): Promise<GoogleWorkspaceResult> {
    return appendRows("Ops Alerts", [
      [
        new Date().toISOString(),
        event.alertId || "",
        event.kind,
        event.title,
        event.message,
        event.bookingId || "",
        event.severity || "",
        event.channel || "",
        event.status || ""
      ]
    ]);
  },

  async appendReportToOpsSheet(
    report: MonthlyReportDocument,
    event: string,
    googleResult?: GoogleWorkspaceResult
  ): Promise<GoogleWorkspaceResult> {
    return appendRows("Reports", [
      [
        new Date().toISOString(),
        report.id,
        report.userId,
        report.month,
        event,
        report.totalVisits,
        report.wellnessSignal,
        report.familyHeadline,
        report.aiNarrative,
        googleResult?.ok && googleResult.details && (googleResult.details as { mode?: string }).mode !== "sheet_fallback"
          ? googleResult.url || ""
          : "",
        googleResult?.ok ? googleResult.url || "" : "",
        googleResult?.ok ? "synced" : googleResult?.error || "not_synced"
      ]
    ]);
  },

  async appendLeadToSheet(lead: CustomerLead): Promise<GoogleWorkspaceResult> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID?.trim();

    if (!spreadsheetId) {
      return unavailable("GOOGLE_SHEETS_LEADS_SPREADSHEET_ID");
    }

    const result = await googleFetch<{
      updates?: { updatedRange?: string };
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent("Leads!A:M")}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        body: JSON.stringify({
          values: [
            [
              new Date(lead.updatedAt || Date.now()).toISOString(),
              lead.id,
              lead.name,
              lead.phone,
              lead.email,
              lead.careFor || "",
              lead.careNeed || "",
              lead.preferredContact || "",
              lead.source,
              lead.status,
              lead.touchCount,
              lead.notes || "",
              lead.lastAction || ""
            ].map(sheetValue)
          ]
        })
      }
    );

    if (!result.ok) {
      return { ok: false, provider: "google_workspace", status: result.status, error: result.error };
    }

    return {
      ok: true,
      provider: "google_workspace",
      id: result.data.updates?.updatedRange,
      details: { updatedRange: result.data.updates?.updatedRange }
    };
  },

  async createOpsCalendarEvent(booking: CareBooking): Promise<GoogleWorkspaceResult> {
    const calendarId = process.env.GOOGLE_CALENDAR_OPS_CALENDAR_ID?.trim();

    if (!calendarId) {
      return unavailable("GOOGLE_CALENDAR_OPS_CALENDAR_ID");
    }

    const result = await googleFetch<{
      id?: string;
      htmlLink?: string;
    }>(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify({
        summary: `LDERLY Care - ${booking.serviceType}`,
        description: [
          `Booking: ${booking.id}`,
          `Customer: ${booking.customerName || booking.customerId}`,
          `Care for: ${booking.requestDetails?.careFor?.displayName || "Family member"}`,
          `Duration: ${booking.requestDetails?.duration?.label || "Not specified"}`,
          `Status: ${booking.status}`,
          `SLA: ${booking.sla?.status || "pending"}`
        ].join("\n"),
        location:
          booking.requestDetails?.location?.detail ||
          booking.tracking?.destinationLabel ||
          "Care location",
        start: { dateTime: eventDateTime(booking.scheduledFor), timeZone: "Asia/Kolkata" },
        end: { dateTime: eventEndDateTime(booking), timeZone: "Asia/Kolkata" },
        extendedProperties: {
          private: {
            bookingId: booking.id,
            customerId: booking.customerId,
            serviceType: booking.serviceType,
            careFor: booking.requestDetails?.careFor?.relationship || "family"
          }
        }
      })
    });

    if (!result.ok) {
      return { ok: false, provider: "google_workspace", status: result.status, error: result.error };
    }

    return {
      ok: true,
      provider: "google_workspace",
      id: result.data.id,
      url: result.data.htmlLink
    };
  },

  async appendMonthlyReportToSheet(report: MonthlyReportDocument): Promise<GoogleWorkspaceResult> {
    const spreadsheetId =
      process.env.GOOGLE_SHEETS_OPS_SPREADSHEET_ID?.trim() ||
      process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID?.trim();

    if (!spreadsheetId) {
      return unavailable("GOOGLE_SHEETS_OPS_SPREADSHEET_ID");
    }

    const result = await googleFetch<{
      updates?: { updatedRange?: string };
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(
        "Monthly Reports!A:L"
      )}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        body: JSON.stringify({
          values: [
            [
              new Date().toISOString(),
              report.id,
              report.userId,
              report.month,
              report.totalVisits,
              report.wellnessSignal,
              report.familyHeadline,
              report.aiNarrative,
              (report.topNextActions || []).join(" | "),
              (report.highlights || []).map((highlight) => highlight.summary).join(" | "),
              "sheet_fallback",
              "Google Docs copy unavailable or not configured"
            ].map(sheetValue)
          ]
        })
      }
    );

    if (!result.ok) {
      return { ok: false, provider: "google_workspace", status: result.status, error: result.error };
    }

    return {
      ok: true,
      provider: "google_workspace",
      id: result.data.updates?.updatedRange,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      details: { mode: "sheet_fallback", updatedRange: result.data.updates?.updatedRange }
    };
  },

  async createMonthlyReportDoc(report: MonthlyReportDocument): Promise<GoogleWorkspaceResult> {
    const templateId = process.env.GOOGLE_DOCS_MONTHLY_REPORT_TEMPLATE_ID?.trim();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();

    if (!templateId) {
      return this.appendMonthlyReportToSheet(report);
    }

    const copyResult = await googleFetch<{
      id?: string;
      webViewLink?: string;
    }>(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateId)}/copy`, {
      method: "POST",
      body: JSON.stringify({
        name: `LDERLY Monthly Care Report - ${report.userId} - ${report.month}`,
        ...(rootFolderId ? { parents: [rootFolderId] } : {})
      })
    });

    if (!copyResult.ok || !copyResult.data.id) {
      const fallback = await this.appendMonthlyReportToSheet(report);

      if (fallback.ok) {
        return fallback;
      }

      return {
        ok: false,
        provider: "google_workspace",
        status: copyResult.ok ? fallback.status : copyResult.status,
        error: copyResult.ok
          ? `Google Docs template copy did not return a document id; Sheets fallback failed: ${fallback.error}`
          : `${copyResult.error}; Sheets fallback failed: ${fallback.error}`
      };
    }

    const docId = copyResult.data.id;
    const highlights = (report.highlights || [])
      .map(
        (highlight) =>
          `${highlight.serviceType}: ${highlight.summary} Next: ${
            highlight.nextBestAction || "Continue normal monitoring"
          }`
      )
      .join("\n");
    const replacements: Record<string, string> = {
      "{{MONTH}}": report.month,
      "{{USER_ID}}": report.userId,
      "{{TOTAL_VISITS}}": String(report.totalVisits),
      "{{WELLNESS_SIGNAL}}": report.wellnessSignal,
      "{{FAMILY_HEADLINE}}": report.familyHeadline,
      "{{AI_NARRATIVE}}": report.aiNarrative,
      "{{TOP_NEXT_ACTIONS}}": (report.topNextActions || []).join("\n") || "Continue normal care.",
      "{{HIGHLIGHTS}}": highlights || "No visit highlights were available for this month."
    };

    const updateResult = await googleFetch<{ replies?: unknown[] }>(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: Object.entries(replacements).map(([token, value]) => ({
            replaceAllText: {
              containsText: { text: token, matchCase: true },
              replaceText: replaceTokens(value)
            }
          }))
        })
      }
    );

    if (!updateResult.ok) {
      return {
        ok: false,
        provider: "google_workspace",
        status: updateResult.status,
        error: updateResult.error
      };
    }

    return {
      ok: true,
      provider: "google_workspace",
      id: docId,
      url: copyResult.data.webViewLink || `https://docs.google.com/document/d/${docId}/edit`
    };
  }
};
