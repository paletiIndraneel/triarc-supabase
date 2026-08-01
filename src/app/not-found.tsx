import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#03110d] px-6 py-16 text-white">
      <div className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          404
        </p>
        <h1 className="mt-4 text-4xl font-black sm:text-5xl">
          This page is unavailable.
        </h1>
        <p className="mt-6 text-base leading-8 text-white/70 sm:text-lg">
          The destination you requested could not be found. Please return to the homepage and continue your journey.
        </p>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
          Back to home
        </Link>
      </div>
    </main>
  );
}
