import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "motion-lift inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-white text-[#06130f] hover:bg-white/90",
        premium: "bg-gradient-to-r from-emerald-200 via-emerald-300 to-teal-200 text-[#06130f] shadow-xl shadow-emerald-300/15 hover:from-emerald-100 hover:to-teal-100",
        calm: "border border-white/10 bg-white/10 text-white backdrop-blur-xl hover:bg-white/15",
        danger: "bg-red-500 text-white shadow-xl shadow-red-500/20 hover:bg-red-400"
      },
      size: {
        default: "px-5 py-3",
        lg: "px-6 py-4 text-base",
        icon: "h-11 w-11 p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
