"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#06130f] px-6 text-white">
          <section className="max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">
              LDERLY
            </p>
            <h1 className="mt-4 text-2xl font-semibold">Care is still protected</h1>
            <p className="mt-3 text-sm leading-6 text-white/65">
              A system view failed to load. Please retry while we keep your session safe.
            </p>
            <button
              onClick={reset}
              className="mt-5 w-full rounded-full bg-white px-5 py-3 font-semibold text-[#06130f]"
            >
              Reload
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
