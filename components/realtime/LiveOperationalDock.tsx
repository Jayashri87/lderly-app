"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { BellRing, Clock3, RadioTower } from "lucide-react";
import { cn } from "../../lib/utils";
import { SystemStatusPill } from "../system/SystemStatusPill";

export type LiveDockSignal = {
  label: string;
  value: string;
};

export const LiveOperationalDock = memo(function LiveOperationalDock({
  title,
  subtitle,
  signals,
  status = "live",
  className
}: {
  title: string;
  subtitle: string;
  signals: LiveDockSignal[];
  status?: "healthy" | "live" | "watch" | "critical" | "idle";
  className?: string;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={cn("glass-panel rounded-[1.5rem] p-3", className)}
      aria-label="Live operational status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RadioTower className="h-4 w-4 shrink-0 text-emerald-100" />
            <p className="truncate text-sm font-semibold">{title}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-white/52">{subtitle}</p>
        </div>
        <SystemStatusPill label={status === "critical" ? "urgent" : "live"} status={status} pulse />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {signals.slice(0, 3).map((signal) => (
          <div key={`${signal.label}-${signal.value}`} className="rounded-2xl bg-white/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
              {signal.label}
            </p>
            <p className="mt-1 truncate text-xs font-semibold">{signal.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-white/45">
        <Clock3 className="h-3.5 w-3.5" />
        Realtime state refresh is active
        <BellRing className="ml-auto h-3.5 w-3.5" />
      </div>
    </motion.aside>
  );
});
