import { shouldSendProductEvent } from "@lderly/analytics";
import type { ProductEventProperties } from "@lderly/shared-types";

let initialized = false;

const persistProductEvent = (
  name: string,
  properties: ProductEventProperties,
  bookingId?: string
) => {
  if (window.localStorage.getItem("lderly-demo-session") === null) {
    return;
  }

  const payload = JSON.stringify({
    name,
    bookingId,
    properties: {
      ...properties,
      path: window.location.pathname,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    }
  });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/analytics/events",
      new Blob([payload], { type: "application/json" })
    );

    if (sent) {
      return;
    }
  }

  fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
};

export const initializeAnalytics = () => {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  if (posthogKey) {
    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          capture_pageview: true,
          autocapture: true,
          person_profiles: "identified_only"
        });
      })
      .catch(() => undefined);
  }

  if (clarityId) {
    import("@microsoft/clarity")
      .then(({ default: clarity }) => {
        clarity.init(clarityId);
      })
      .catch(() => undefined);
  }
};

export const trackProductEvent = (name: string, properties: ProductEventProperties = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!shouldSendProductEvent(name, properties)) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("lderly:analytics", {
      detail: {
        name,
        properties,
        at: Date.now()
      }
    })
  );

  import("posthog-js")
    .then(({ default: posthog }) => {
      if (posthog.__loaded) {
        posthog.capture(name, properties);
      }
    })
    .catch(() => undefined);

  persistProductEvent(
    name,
    properties,
    typeof properties.bookingId === "string" ? properties.bookingId : undefined
  );
};
