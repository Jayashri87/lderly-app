"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { HealthAlert } from "@lderly/ruview-integration";

interface HealthAlertBannerProps {
  onAlert?: (alert: HealthAlert) => void;
}

export function HealthAlertBanner({ onAlert }: HealthAlertBannerProps) {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling) return;

    // In a real app, this would connect to the API Gateway WebSocket
    // For now, we poll the health status
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/health");
        // Check for any alerts from the API response
      } catch (error) {
        console.error("Failed to poll health status:", error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [isPolling]);

  const removeAlert = (id: number) => {
    setAlerts((prev) => prev.filter((_, i) => i !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-3 rounded-lg p-4 text-white backdrop-blur-sm border ${
            alert.severity === "critical"
              ? "bg-rose-600/90 border-rose-500"
              : alert.severity === "high"
              ? "bg-amber-600/90 border-amber-500"
              : "bg-blue-600/90 border-blue-500"
          }`}
        >
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-sm capitalize">
              {alert.type} Alert
            </div>
            <div className="text-sm opacity-90">{alert.message}</div>
            <div className="text-xs opacity-75 mt-1">Node: {alert.nodeId}</div>
          </div>
          <button
            onClick={() => removeAlert(idx)}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
