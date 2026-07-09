import Link from "next/link";
import { ImportSubstackForm } from "./ImportSubstackForm";

export const dynamic = "force-dynamic";

export default function ImportSubstackPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <Link className="text-sm font-medium text-slate-500" href="/">
        Dashboard
      </Link>
      <header className="mt-6 border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
          Import
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Substack archive
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Paste the Substack publication URL or RSS feed URL. The importer will
          preview feed items, skip duplicates, and create canonical posts on
          blog.mspk.me.
        </p>
      </header>

      <section className="mt-6">
        <ImportSubstackForm />
      </section>
    </main>
  );
}
