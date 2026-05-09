import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06130f] px-5 text-white">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-6 text-[#06130f]">
        <p className="text-sm font-semibold text-emerald-700">LDERLY</p>
        <h1 className="mt-3 text-3xl font-semibold">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Care details saved on this device will appear when your connection returns.
          For urgent help, call your local emergency number or family contact directly.
        </p>
        <Link
          href="/"
          className="mt-6 block rounded-full bg-[#06130f] px-5 py-4 text-center font-semibold text-white"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
