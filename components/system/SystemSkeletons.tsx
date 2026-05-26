import { Skeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";

export function DashboardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="glass-panel rounded-[1.5rem] p-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function LiveCareSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass-panel rounded-[2rem] p-5", className)} aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-8 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
        <Skeleton className="h-12 w-12 rounded-2xl" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  );
}
