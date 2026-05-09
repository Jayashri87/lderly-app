import type { CareNotification } from "../services/notificationService";

export type DeliveryResult = {
  mode:
    | "exotel_voice"
    | "in_app"
    | "manual_whatsapp"
    | "mock"
    | "msg91_sms"
    | "twilio";
  status: CareNotification["deliveryStatus"];
  providerReference: string;
};

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioSmsFrom = process.env.TWILIO_SMS_FROM;
const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
const msg91AuthKey = process.env.MSG91_AUTH_KEY;
const msg91SenderId = process.env.MSG91_SENDER_ID;
const msg91TemplateId = process.env.MSG91_TEMPLATE_ID;
const whatsappBusinessPhoneId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
const whatsappBusinessToken = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
const whatsappOpsNumber = process.env.WHATSAPP_MANUAL_OPS_NUMBER;
const exotelSid = process.env.EXOTEL_SID;
const exotelApiKey = process.env.EXOTEL_API_KEY;
const exotelApiToken = process.env.EXOTEL_API_TOKEN;
const exotelCallerId = process.env.EXOTEL_CALLER_ID;

export const hasMessagingProviderConfig = Boolean(
  (msg91AuthKey && msg91SenderId) ||
    (whatsappBusinessPhoneId && whatsappBusinessToken) ||
    whatsappOpsNumber ||
    (exotelSid && exotelApiKey && exotelApiToken && exotelCallerId) ||
    (twilioAccountSid && twilioAuthToken && (twilioSmsFrom || twilioWhatsappFrom))
);

export const communicationReadiness = {
  whatsappBusinessConfigured: Boolean(whatsappBusinessPhoneId && whatsappBusinessToken),
  whatsappManualReady: Boolean(whatsappOpsNumber),
  msg91SmsConfigured: Boolean(msg91AuthKey && msg91SenderId),
  exotelVoiceConfigured: Boolean(exotelSid && exotelApiKey && exotelApiToken && exotelCallerId),
  firebasePushPrepared: true,
  twilioFallbackConfigured: Boolean(
    twilioAccountSid && twilioAuthToken && (twilioSmsFrom || twilioWhatsappFrom)
  )
};

const twilioNumberFor = (channel: CareNotification["channel"]) => {
  if (channel === "whatsapp" && twilioWhatsappFrom) {
    return twilioWhatsappFrom.startsWith("whatsapp:")
      ? twilioWhatsappFrom
      : `whatsapp:${twilioWhatsappFrom}`;
  }

  return twilioSmsFrom || "";
};

const destinationFor = (channel: CareNotification["channel"], to: string) => {
  if (channel === "whatsapp") {
    return to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  }

  return to;
};

export const deliverNotification = async ({
  notification,
  to
}: {
  notification: CareNotification;
  to?: string;
}): Promise<DeliveryResult> => {
  if (notification.channel === "in_app") {
    return {
      mode: "in_app",
      status: "sent",
      providerReference: `in-app-${notification.id}`
    };
  }

  if (notification.channel === "sms" && msg91AuthKey && msg91SenderId && to) {
    const response = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: {
        authkey: msg91AuthKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        template_id: msg91TemplateId,
        sender: msg91SenderId,
        short_url: "0",
        mobiles: to.replace(/^\+/, ""),
        title: notification.title,
        message: notification.body
      })
    });

    return {
      mode: "msg91_sms",
      status: response.ok ? "sent" : "failed",
      providerReference: `msg91-${response.status}-${Date.now()}`
    };
  }

  if (notification.channel === "whatsapp") {
    if (whatsappBusinessPhoneId && whatsappBusinessToken && to) {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${whatsappBusinessPhoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${whatsappBusinessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace(/^whatsapp:/, "").replace(/^\+/, ""),
            type: "text",
            text: {
              preview_url: false,
              body: `${notification.title}\n${notification.body}`
            }
          })
        }
      );

      return {
        mode: "manual_whatsapp",
        status: response.ok ? "sent" : "failed",
        providerReference: `whatsapp-cloud-${response.status}-${Date.now()}`
      };
    }

    if (whatsappOpsNumber) {
      return {
        mode: "manual_whatsapp",
        status: "queued",
        providerReference: `manual-whatsapp-${notification.id}-${Date.now()}`
      };
    }
  }

  if (
    notification.channel === "voice" &&
    exotelSid &&
    exotelApiKey &&
    exotelApiToken &&
    exotelCallerId &&
    to
  ) {
    const form = new URLSearchParams({
      From: exotelCallerId,
      To: to,
      CallerId: exotelCallerId,
      TimeLimit: "120",
      TimeOut: "30"
    });
    const response = await fetch(
      `https://${exotelApiKey}:${exotelApiToken}@api.exotel.com/v1/Accounts/${exotelSid}/Calls/connect.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form
      }
    );

    return {
      mode: "exotel_voice",
      status: response.ok ? "sent" : "failed",
      providerReference: `exotel-${response.status}-${Date.now()}`
    };
  }

  if (
    !hasMessagingProviderConfig ||
    !to ||
    notification.channel === "voice" ||
    !twilioAccountSid ||
    !twilioAuthToken
  ) {
    return {
      mode: "mock",
      status: "queued",
      providerReference: `mock-${notification.channel}-${Date.now()}`
    };
  }

  const from = twilioNumberFor(notification.channel);

  if (!from) {
    return {
      mode: "mock",
      status: "queued",
      providerReference: `mock-${notification.channel}-${Date.now()}`
    };
  }

  const form = new URLSearchParams({
    From: from,
    To: destinationFor(notification.channel, to),
    Body: `${notification.title}\n${notification.body}`
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${twilioAccountSid}:${twilioAuthToken}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    }
  );

  if (!response.ok) {
    return {
      mode: "twilio",
      status: "failed",
      providerReference: `twilio-error-${response.status}`
    };
  }

  const payload = (await response.json()) as { sid?: string };

  return {
    mode: "twilio",
    status: "sent",
    providerReference: payload.sid || `twilio-${Date.now()}`
  };
};
