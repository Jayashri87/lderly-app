import { Skeleton } from "../ui/skeleton";

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
