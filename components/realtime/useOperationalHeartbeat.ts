"use client";

import { useEffect, useMemo, useState } from "react";
import { formatHeartbeatAge, heartbeatIntervalMs } from "../../lib/motion/heartbeat";

export function useOperationalHeartbeat(intervalMs = heartbeatIntervalMs) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return useMemo(
    () => ({
      now,
      label: formatHeartbeatAge(now, startedAt),
      beat: Math.floor((now - startedAt) / intervalMs)
    }),
    [intervalMs, now, startedAt]
  );
}
