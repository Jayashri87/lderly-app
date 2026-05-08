import type { CareNotification } from "../services/notificationService";

export type DeliveryResult = {
  mode: "twilio" | "mock" | "in_app";
  status: CareNotification["deliveryStatus"];
  providerReference: string;
};

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioSmsFrom = process.env.TWILIO_SMS_FROM;
const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

export const hasMessagingProviderConfig = Boolean(
  twilioAccountSid && twilioAuthToken && (twilioSmsFrom || twilioWhatsappFrom)
);

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
