import { cn } from "../../lib/utils";
import { statusTone, type OperationalStatus } from "../../lib/design/tokens";

export function SystemStatusPill({
  label,
  status = "live",
  pulse = false
}: {
  label: string;
  status?: OperationalStatus;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em]",
        statusTone[status]
      )}
    >
      {pulse ? <span className={status === "critical" ? "emergency-dot" : "status-dot"} /> : null}
      {label}
    </span>
  );
}
