/**
 * React Query hooks for RuView vital signs data
 */

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { VitalSigns, SensingUpdate } from "@lderly/ruview-integration";

interface UseVitalsOptions
  extends Omit<UseQueryOptions, "queryKey" | "queryFn"> {
  refetchInterval?: number;
}

/**
 * Fetch vital signs for a specific node
 */
export function useNodeVitals(nodeId: string, options?: UseVitalsOptions) {
  return useQuery({
    queryKey: ["vitals", nodeId],
    queryFn: async () => {
      const res = await fetch(`/api/vitals/${nodeId}`);
      if (!res.ok) throw new Error("Failed to fetch vital signs");
      return res.json();
    },
    refetchInterval: options?.refetchInterval ?? 2000,
    ...options,
  });
}

/**
 * Fetch vital signs from all nodes
 */
export function useAllVitals(options?: UseVitalsOptions) {
  return useQuery({
    queryKey: ["vitals"],
    queryFn: async () => {
      const res = await fetch("/api/vitals");
      if (!res.ok) throw new Error("Failed to fetch vitals");
      return res.json();
    },
    refetchInterval: options?.refetchInterval ?? 2000,
    ...options,
  });
}

/**
 * Check if presence is detected in any node
 */
export function usePresence(options?: UseVitalsOptions) {
  const { data } = useAllVitals(options);
  return data?.data?.some((v: SensingUpdate) => v.vitalSigns.presence) ?? false;
}

/**
 * Get total person count across all nodes
 */
export function useTotalPersonCount(options?: UseVitalsOptions) {
  const { data } = useAllVitals(options);
  return (
    data?.data?.reduce(
      (sum: number, v: SensingUpdate) => sum + v.vitalSigns.personCount,
      0
    ) ?? 0
  );
}
