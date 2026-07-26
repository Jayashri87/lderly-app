"use client";

import { useEffect, useState } from "react";
import type { SensingUpdate, HealthAlert } from "@lderly/ruview-integration";

interface UseVitalsWebSocketOptions {
  autoConnect?: boolean;
  reconnectionDelay?: number;
}

export function useVitalsWebSocket(
  options: UseVitalsWebSocketOptions = {}
) {
  const [vitals, setVitals] = useState<Map<string, SensingUpdate>>(new Map());
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // In production, connect to /api/vitals via long-polling or WebSocket
    // For now, use REST API with polling
    
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/vitals");
        if (res.ok) {
          const data = await res.json();
          const map = new Map(
            data.data?.map((v: SensingUpdate) => [v.nodeId, v]) || []
          );
          setVitals(map);
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to fetch vitals:", error);
        setIsConnected(false);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  return {
    vitals,
    alerts,
    isConnected,
  };
}
