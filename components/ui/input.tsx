import * as React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white shadow-sm transition placeholder:text-white/40 focus-visible:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/35 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
