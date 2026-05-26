import { amber, indigo, jade, red, slate } from "@radix-ui/colors";

export const designTokens = {
  color: {
    ink: slate.slate12,
    inkSoft: slate.slate11,
    surface: "rgba(255,255,255,0.1)",
    surfaceStrong: "rgba(255,255,255,0.16)",
    emerald: jade.jade9,
    emeraldSoft: jade.jade4,
    indigo: indigo.indigo8,
    amber: amber.amber9,
    emergency: red.red9,
    warmWhite: "#f8faf7"
  },
  radius: {
    card: "1.5rem",
    panel: "2rem",
    pill: "999px"
  },
  shadow: {
    glass: "0 28px 80px rgba(0,0,0,0.32)",
    lift: "0 24px 70px rgba(0,0,0,0.28)",
    emergency: "0 24px 70px rgba(251,54,72,0.28)"
  },
  spacing: {
    shellX: "1rem",
    section: "1.5rem",
    card: "1.25rem"
  }
} as const;

export type OperationalStatus = "healthy" | "live" | "watch" | "critical" | "idle";

export const statusTone: Record<OperationalStatus, string> = {
  healthy: "bg-emerald-300 text-[#06130f]",
  live: "bg-cyan-200 text-[#06130f]",
  watch: "bg-amber-300 text-[#06130f]",
  critical: "bg-rose-500 text-white",
  idle: "bg-white/10 text-white/65"
};
