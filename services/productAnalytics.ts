let initialized = false;

type ProductEventProperties = Record<string, unknown>;

const recentEvents = new Map<string, number>();

const compactEventKey = (name: string, properties: ProductEventProperties) =>
  `${name}:${JSON.stringify(properties).slice(0, 240)}`;

const shouldSendEvent = (name: string, properties: ProductEventProperties) => {
  const key = compactEventKey(name, properties);
  const previous = recentEvents.get(key) || 0;
  const now = Date.now();

  if (now - previous < 800) {
    return false;
  }

  recentEvents.set(key, now);

  if (recentEvents.size > 80) {
    Array.from(recentEvents.entries())
      .slice(0, 20)
      .forEach(([eventKey]) => recentEvents.delete(eventKey));
  }

  return true;
};

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

export const trackProductEvent = (
  name: string,
  properties: ProductEventProperties = {}
) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!shouldSendEvent(name, properties)) {
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
