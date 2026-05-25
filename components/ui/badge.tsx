import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border border-white/10 bg-white/10 text-white/70 backdrop-blur-xl",
      trust: "bg-gradient-to-r from-emerald-200 to-teal-200 text-[#06130f] shadow-lg shadow-emerald-300/15",
      warning: "bg-amber-300/20 text-amber-100",
      danger: "bg-red-500/20 text-red-100"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
