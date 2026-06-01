import type { ProductEventProperties } from "@lderly/shared-types";

const recentEvents = new Map<string, number>();

export const compactEventKey = (name: string, properties: ProductEventProperties) =>
  `${name}:${JSON.stringify(properties).slice(0, 240)}`;

export const shouldSendProductEvent = (
  name: string,
  properties: ProductEventProperties,
  dedupeWindowMs = 800
) => {
  const key = compactEventKey(name, properties);
  const previous = recentEvents.get(key) || 0;
  const now = Date.now();

  if (now - previous < dedupeWindowMs) {
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
