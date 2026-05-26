export const heartbeatIntervalMs = 30_000;

export function formatHeartbeatAge(now: number, previous: number) {
  const seconds = Math.max(0, Math.round((now - previous) / 1000));

  if (seconds < 5) {
    return "live now";
  }

  if (seconds < 60) {
    return `refreshed ${seconds}s ago`;
  }

  return `refreshed ${Math.round(seconds / 60)} min ago`;
}
