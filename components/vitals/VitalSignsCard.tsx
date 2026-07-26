"use client";

import { useQuery } from "@tanstack/react-query";
import { Heart, Wind, Zap, Users, AlertTriangle } from "lucide-react";

interface VitalSigns {
  heartRate?: number;
  breathingRate?: number;
  presence: boolean;
  personCount: number;
  motionLevel: number;
  timestamp: Date;
}

interface VitalSignsCardProps {
  nodeId: string;
}

export function VitalSignsCard({ nodeId }: VitalSignsCardProps) {
  const { data: vitals, isLoading, error } = useQuery({
    queryKey: ["vitals", nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/vitals/${nodeId}`);
      if (!res.ok) throw new Error("Failed to fetch vital signs");
      const data = await res.json();
      return data.vitalSigns as VitalSigns;
    },
    refetchInterval: 2000, // Update every 2 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 animate-pulse">
        <div className="h-32 bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (error || !vitals) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-rose-500">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">Unable to connect to sensor</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 border border-slate-700">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-1">{nodeId}</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              vitals.presence ? "bg-emerald-500" : "bg-slate-600"
            }`}
          />
          <span className="text-xs text-slate-400">
            {vitals.presence ? "Presence detected" : "No presence"}
          </span>
        </div>
      </div>

      {/* Vital Signs Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Heart Rate */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-slate-400">Heart Rate</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {vitals.heartRate ?? "--"}
          </div>
          <span className="text-xs text-slate-500">BPM</span>
        </div>

        {/* Breathing Rate */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Wind className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-400">Breathing</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {vitals.breathingRate ?? "--"}
          </div>
          <span className="text-xs text-slate-500">BPM</span>
        </div>

        {/* Motion Level */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-400">Motion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-slate-100">
              {Math.round(vitals.motionLevel * 100)}
            </div>
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all"
                style={{ width: `${vitals.motionLevel * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-slate-500">%</span>
        </div>

        {/* People Count */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-xs text-slate-400">People</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {vitals.personCount}
          </div>
          <span className="text-xs text-slate-500">person(s)</span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="pt-4 border-t border-slate-700/50">
        <span className="text-xs text-slate-500">
          Updated {new Date(vitals.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
