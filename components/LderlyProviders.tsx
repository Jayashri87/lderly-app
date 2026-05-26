"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Lenis from "lenis";
import { Toaster } from "sonner";
import { installFirebaseAppCheckFetch } from "../firebase";
import { initializeAnalytics } from "../services/productAnalytics";

export function LderlyProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1
          },
          mutations: {
            retry: 0
          }
        }
      })
  );

  useEffect(() => {
    initializeAnalytics();
    installFirebaseAppCheckFetch();

    if (process.env.NEXT_PUBLIC_REACT_SCAN === "true") {
      import("react-scan/auto").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return undefined;
    }

    const lenis = new Lenis({
      duration: 0.85,
      smoothWheel: true,
      touchMultiplier: 1.05
    });
    let frameId = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(raf);
    };

    frameId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          className: "glass-panel border-white/15 text-white",
          duration: 4200
        }}
      />
    </QueryClientProvider>
  );
}
