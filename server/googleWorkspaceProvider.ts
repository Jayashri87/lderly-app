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
