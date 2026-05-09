import { getAdminDatabase } from "./firebaseAdmin";

export type InternalOpsAlertKind =
  | "ai_risk"
  | "emergency"
  | "incident"
  | "late_checkin"
  | "sla_breach";

export type InternalOpsAlert = {
  kind: InternalOpsAlertKind;
  title: string;
  message: string;
  bookingId?: string;
  severity?: "low" | "medium" | "high" | "critical";
  channel?: string;
};

const slackWebhookUrl = process.env.SLACK_OPS_WEBHOOK_URL;

const channelFor = (kind: InternalOpsAlertKind) => {
  if (kind === "emergency") {
    return "#emergency-alerts";
  }

  if (kind === "late_checkin" || kind === "sla_breach") {
    return "#late-checkins";
  }

  if (kind === "incident") {
    return "#incident-reports";
  }

  return "#caregiver-ops";
};

export const internalOpsReadiness = {
  slackConfigured: Boolean(slackWebhookUrl),
  emergencyAlertsChannel: "#emergency-alerts",
  caregiverOpsChannel: "#caregiver-ops",
  lateCheckinsChannel: "#late-checkins",
  incidentReportsChannel: "#incident-reports"
};

export const dispatchInternalOpsAlert = async (alert: InternalOpsAlert) => {
  const channel = alert.channel || channelFor(alert.kind);
  const id = `ops-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    id,
    ...alert,
    channel,
    severity: alert.severity || "medium",
    status: slackWebhookUrl ? "sent" : "queued",
    createdAt: Date.now()
  };

  const database = getAdminDatabase();

  await database?.ref().update({
    [`operations/internalAlerts/byId/${id}`]: payload,
    [`operations/internalAlerts/byKind/${alert.kind}/${id}`]: true,
    [`operations/internalAlerts/bySeverity/${payload.severity}/${id}`]: true
  });

  if (slackWebhookUrl) {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel,
        text: `*${alert.title}*\n${alert.message}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${alert.title}*\n${alert.message}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Kind: ${alert.kind} | Severity: ${payload.severity}${
                  alert.bookingId ? ` | Booking: ${alert.bookingId}` : ""
                }`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      await database?.ref(`operations/internalAlerts/byId/${id}`).update({
        status: "failed",
        providerReference: `slack-${response.status}`
      });
      return {
        ok: false as const,
        status: response.status,
        alert: {
          ...payload,
          status: "failed"
        }
      };
    }
  }

  return {
    ok: true as const,
    alert: payload
  };
};
