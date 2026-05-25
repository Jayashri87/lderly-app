import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border p-4 text-sm leading-6",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/10 text-white",
        success: "border-emerald-200/20 bg-emerald-200/10 text-emerald-50",
        warning: "border-amber-200/25 bg-amber-200/10 text-amber-50",
        destructive: "border-red-200/20 bg-red-500/15 text-red-50"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-semibold", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-white/70", className)} {...props} />;
}
