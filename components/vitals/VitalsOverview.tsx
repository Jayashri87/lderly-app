"use client";

import { useQuery } from "@tanstack/react-query";
import { VitalSignsCard } from "./VitalSignsCard";
import { AlertTriangle, Wifi } from "lucide-react";

interface VitalsOverviewProps {
  refreshInterval?: number;
}

export function VitalsOverview({ refreshInterval = 2000 }: VitalsOverviewProps) {
  const { data: vitals, isLoading, error } = useQuery({
    queryKey: ["vitals"],
    queryFn: async () => {
      const res = await fetch("/api/vitals");
      if (!res.ok) throw new Error("Failed to fetch vitals");
      return res.json();
    },
    refetchInterval: refreshInterval,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-slate-800 rounded-lg p-6 animate-pulse h-48"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 border border-rose-500/30">
        <div className="flex items-center gap-3 text-rose-500">
          <AlertTriangle className="w-6 h-6" />
          <div>
            <div className="font-semibold">Connection Error</div>
            <div className="text-sm opacity-75">Unable to connect to RuView sensors</div>
          </div>
        </div>
      </div>
    );
  }

  if (!vitals?.data || vitals.data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-8 border border-slate-700 text-center">
        <Wifi className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
        <div className="text-slate-300 font-medium">No RuView Sensors Connected</div>
        <div className="text-sm text-slate-500 mt-2">
          Start the RuView MQTT publisher to see vital signs
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100 mb-4">
          Vital Signs ({vitals.count})
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vitals.data.map((vital: any) => (
          <VitalSignsCard key={vital.nodeId} nodeId={vital.nodeId} />
        ))}
      </div>
    </div>
  );
}
