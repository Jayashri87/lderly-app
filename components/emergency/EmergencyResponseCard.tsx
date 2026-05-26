"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, PhoneCall, Route } from "lucide-react";
import { cn } from "../../lib/utils";

export type EmergencyStep = {
  label: string;
  status: "done" | "active" | "next";
};

const stepClass = {
  done: "bg-emerald-300 text-[#06130f]",
  active: "bg-rose-500 text-white",
  next: "bg-white/10 text-white/55"
};

export const EmergencyResponseCard = memo(function EmergencyResponseCard({
  active,
  title,
  description,
  steps,
  className
}: {
  active: boolean;
  title: string;
  description: string;
  steps: EmergencyStep[];
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: active ? 320 : 220, damping: 26 }}
      className={cn(active ? "emergency-surface" : "glass-panel", "rounded-[2rem] p-5", className)}
      aria-label="Emergency response status"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-100">
            <span className={active ? "emergency-dot" : "status-dot"} aria-hidden="true" />
            Immediate Assistance
          </p>
          <h2 className="premium-title mt-2 text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
          {active ? <PhoneCall className="h-6 w-6 text-rose-100" /> : <AlertTriangle className="h-6 w-6 text-amber-100" />}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", stepClass[step.status])}>
              {step.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{step.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: step.status === "done" ? "100%" : step.status === "active" ? "62%" : "12%" }}
                  transition={{ duration: 0.45 }}
                  className={cn("h-full rounded-full", step.status === "active" ? "bg-rose-400" : "bg-emerald-300")}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 flex items-center gap-2 rounded-2xl bg-white/10 p-3 text-xs leading-5 text-white/58">
        <Route className="h-4 w-4 shrink-0 text-emerald-100" />
        Family, ops team, ambulance, and hospital escalation path stays visible during critical events.
      </p>
    </motion.section>
  );
});
