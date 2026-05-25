"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
