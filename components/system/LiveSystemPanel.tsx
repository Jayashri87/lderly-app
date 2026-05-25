"use client";

import { motion } from "framer-motion";
import { Activity, Clock3, ShieldCheck } from "lucide-react";
import { fadeUp, staggerContainer } from "../../lib/motion/presets";
import { cn } from "../../lib/utils";

type LiveSignal = {
  label: string;
  value: string;
  tone?: "healthy" | "live" | "watch" | "critical" | "idle";
};

const toneClass = {
  healthy: "bg-emerald-300 text-[#06130f]",
  live: "bg-cyan-200 text-[#06130f]",
  watch: "bg-amber-300 text-[#06130f]",
  critical: "bg-rose-500 text-white",
  idle: "bg-white/10 text-white/65"
};

export function LiveSystemPanel({
  eyebrow,
  title,
  description,
  signals,
  urgent = false,
  className
}: {
  eyebrow: string;
  title: string;
  description: string;
  signals: LiveSignal[];
  urgent?: boolean;
  className?: string;
}) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={cn(
        urgent ? "emergency-surface" : "glass-panel",
        "relative overflow-hidden rounded-[2rem] p-5",
        className
      )}
    >
      <motion.div
        aria-hidden
        animate={{ opacity: urgent ? [0.25, 0.6, 0.25] : [0.12, 0.26, 0.12] }}
        transition={{ duration: urgent ? 1.4 : 4.8, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "absolute right-4 top-4 h-24 w-24 rounded-full blur-3xl",
          urgent ? "bg-rose-400" : "bg-emerald-300"
        )}
      />
      <motion.div variants={fadeUp} className="relative flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
            <span className={urgent ? "emergency-dot" : "live-dot"} aria-hidden="true" />
            {eyebrow}
          </p>
          <h2 className="premium-title mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
          {urgent ? <Activity className="h-6 w-6 text-rose-100" /> : <ShieldCheck className="h-6 w-6 text-emerald-100" />}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="relative mt-5 grid grid-cols-3 gap-2">
        {signals.slice(0, 3).map((signal) => (
          <div key={`${signal.label}-${signal.value}`} className="rounded-2xl bg-white/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/42">
              {signal.label}
            </p>
            <p className="mt-2 text-sm font-semibold">{signal.value}</p>
            <span
              className={cn(
                "mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                toneClass[signal.tone || "live"]
              )}
            >
              {signal.tone || "live"}
            </span>
          </div>
        ))}
      </motion.div>
    </motion.section>
  );
}

export function LiveActivityTimeline({
  items,
  className
}: {
  items: Array<{ label: string; time: string; status?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("glass-panel rounded-[1.5rem] p-4", className)}>
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
          <Clock3 className="h-4 w-4" />
          Live timeline
        </p>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/60">
          refreshing
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={`${item.label}-${item.time}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-3"
          >
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(52,211,153,0.1)]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs text-white/45">
                {item.time}
                {item.status ? ` - ${item.status}` : ""}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
