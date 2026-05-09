import Link from "next/link";

export default function LegalPage({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#06130f] px-5 py-8 text-white">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-emerald-200">
          LDERLY
        </Link>
        <p className="mt-10 text-sm uppercase tracking-[0.24em] text-emerald-200">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
        <section className="mt-8 space-y-5 rounded-[2rem] bg-white p-6 text-sm leading-7 text-slate-700">
          {children}
        </section>
      </article>
    </main>
  );
}
