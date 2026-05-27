"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "./ui/skeleton";
import type { CareJourney } from "../services/journeyService";

const LiveMapClient = dynamic(() => import("./LiveMapClient"), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-64 rounded-3xl border border-white/10 bg-white/10" />
      <Skeleton className="h-32 rounded-2xl border border-white/10 bg-white/10" />
    </div>
  )
});

export default function LiveMap({ journey }: { journey: CareJourney | null }) {
  return <LiveMapClient journey={journey} />;
}
