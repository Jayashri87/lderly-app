"use client";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06130f] px-6 text-white">
      <section className="max-w-sm rounded-[2rem] border border-white/10 bg-white/10 p-6 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">
          LDERLY
        </p>
        <h1 className="mt-4 text-2xl font-semibold">Something needs attention</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          We could not load this care view. Your booking and care records are still protected.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-full bg-white/10 px-3 py-2 text-xs text-white/55">
            Reference {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-5 w-full rounded-full bg-white px-5 py-3 font-semibold text-[#06130f]"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
