"use client";

import { useState, useTransition } from "react";
import {
  importSubstackFeed,
  previewSubstackFeed,
  type SubstackPreviewItem,
} from "./actions";

type ImportResult = {
  imported: number;
  skipped: number;
  total: number;
  feedUrl: string;
};

export function ImportSubstackForm() {
  const [feedUrl, setFeedUrl] = useState("");
  const [items, setItems] = useState<SubstackPreviewItem[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview(formData: FormData) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const preview = await previewSubstackFeed(formData);
        setFeedUrl(preview.feedUrl);
        setItems(preview.items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Preview failed.");
      }
    });
  }

  function handleImport(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const importResult = await importSubstackFeed(formData);
        setResult(importResult);
        const preview = await previewSubstackFeed(formData);
        setItems(preview.items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Import failed.");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <form action={handlePreview} className="rounded-lg border border-white/10 bg-[#141414] p-5">
        <label className="grid gap-2 text-sm font-semibold text-zinc-300">
          Substack publication or feed URL
          <input
            className="h-11 rounded-md border border-white/10 bg-black px-3 text-white outline-none ring-orange-500/20 placeholder:text-zinc-600 focus:ring-4"
            name="feedUrl"
            onChange={(event) => setFeedUrl(event.target.value)}
            placeholder="https://your-publication.substack.com"
            required
            type="url"
            value={feedUrl}
          />
        </label>
        <button
          className="mt-4 h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Working..." : "Preview feed"}
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Imported {result.imported} posts. Skipped {result.skipped} existing
          posts from {result.total} feed items.
        </div>
      ) : null}

      {items.length > 0 ? (
        <section className="rounded-lg border border-white/10 bg-[#141414]">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Preview {items.length} feed items
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Existing posts will be skipped during import.
              </p>
            </div>
            <form action={handleImport}>
              <input name="feedUrl" type="hidden" value={feedUrl} />
              <button
                className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                Import new posts
              </button>
            </form>
          </div>
          <div className="divide-y divide-white/10">
            {items.map((item) => (
              <article className="p-5" key={item.sourceUrl}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      /posts/{item.slug}
                    </p>
                  </div>
                  <span className="w-fit rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                    {item.exists ? "Existing" : "New"}
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                  {item.excerpt || "No excerpt found."}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
