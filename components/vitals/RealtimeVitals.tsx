"use client";

import { useVitalsWebSocket } from "@/lib/hooks/useVitalsWebSocket";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";

interface RealtimeVitalsProps {
  className?: string;
}

export function RealtimeVitals({ className = "" }: RealtimeVitalsProps) {
  const { vitals, isConnected } = useVitalsWebSocket();

  if (!isConnected) {
    return (
      <div className={`bg-slate-800 rounded-lg p-8 border border-slate-700 text-center ${className}`}>
        <WifiOff className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
        <div className="text-slate-300 font-medium">Connecting to sensors...</div>
        <div className="text-sm text-slate-500 mt-2">Please wait</div>
      </div>
    );
  }

  if (vitals.size === 0) {
    return (
      <div className={`bg-slate-800 rounded-lg p-8 border border-slate-700 text-center ${className}`}>
        <Wifi className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
        <div className="text-slate-300 font-medium">No RuView Sensors Connected</div>
        <div className="text-sm text-slate-500 mt-2">
          Start the RuView MQTT publisher
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from(vitals.values()).map((vital) => (
          <div key={vital.nodeId} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="text-sm font-semibold text-slate-200 mb-2">
              {vital.nodeId}
            </div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-slate-400">HR:</span>{" "}
                <span className="text-slate-100 font-medium">
                  {vital.vitalSigns.heartRate ?? "--"} BPM
                </span>
              </div>
              <div>
                <span className="text-slate-400">BR:</span>{" "}
                <span className="text-slate-100 font-medium">
                  {vital.vitalSigns.breathingRate ?? "--"} BPM
                </span>
              </div>
              <div>
                <span className="text-slate-400">Motion:</span>{" "}
                <span className="text-slate-100 font-medium">
                  {Math.round(vital.vitalSigns.motionLevel * 100)}%
                </span>
              </div>
              <div>
                <span className="text-slate-400">People:</span>{" "}
                <span className="text-slate-100 font-medium">
                  {vital.vitalSigns.personCount}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
