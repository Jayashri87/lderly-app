let initialized = false;

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
  properties: Record<string, unknown> = {}
) => {
  if (typeof window === "undefined") {
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
};
