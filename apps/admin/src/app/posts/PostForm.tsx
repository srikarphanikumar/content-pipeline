"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Post, PostStatus } from "@content-pipeline/db";
import { SubmitButton } from "../components/SubmitButton";

const statuses: PostStatus[] = [
  "IDEA",
  "SELECTED",
  "DRAFTING",
  "DRAFT_READY",
  "READY_TO_PUBLISH",
  "PUBLISHED_BLOG",
  "PUBLISHED_DEVTO",
  "PROMOTED_LINKEDIN",
  "PROMOTED_SOCIAL",
  "COMPLETE",
];

const labelClass = "grid gap-1.5 text-sm font-medium text-zinc-300";
const inputClass =
  "h-10 rounded-lg border border-line bg-canvas px-3 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500";
const textareaClass =
  "rounded-lg border border-line bg-canvas px-3 py-2.5 text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500";

type PostFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  post?: Post;
};

export function PostForm({ action, post }: PostFormProps) {
  const [bodyMarkdown, setBodyMarkdown] = useState(post?.bodyMarkdown || "");
  const [mode, setMode] = useState<"write" | "preview">("write");

  return (
    <form action={action} className="grid gap-4">
      <label className={labelClass}>
        Title
        <input className={inputClass} name="title" required defaultValue={post?.title} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Subtitle
          <input className={inputClass} name="subtitle" defaultValue={post?.subtitle || ""} />
        </label>
        <label className={labelClass}>
          Tags
          <input
            className={inputClass}
            name="tags"
            placeholder="Frontend, AI UX"
            defaultValue={post?.tags.join(", ") || ""}
          />
        </label>
      </div>

      <label className={labelClass}>
        Description
        <textarea
          className={`${textareaClass} text-sm`}
          name="description"
          rows={2}
          defaultValue={post?.description || ""}
        />
      </label>

      <details className="group rounded-lg border border-line px-3 py-2">
        <summary className="cursor-pointer list-none text-sm text-zinc-400 hover:text-white">
          <span className="inline-block transition group-open:rotate-90">›</span> Details: slug, status,
          dates, canonical URL
        </summary>
        <div className="mt-3 grid gap-4 pb-1 md:grid-cols-2">
          <label className={labelClass}>
            Slug
            <input
              className={inputClass}
              name="slug"
              placeholder="generated-from-title-if-empty"
              defaultValue={post?.slug}
            />
          </label>
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue={post?.status || "DRAFT_READY"}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Published date
            <input
              className={inputClass}
              name="publishedAt"
              type="date"
              defaultValue={post?.publishedAt?.toISOString().slice(0, 10) || ""}
            />
          </label>
          <label className={labelClass}>
            Canonical URL
            <input
              className={inputClass}
              name="canonicalUrl"
              placeholder="https://blog.mspk.me/posts/..."
              defaultValue={post?.canonicalUrl || ""}
            />
          </label>
        </div>
      </details>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Body</span>
          <div className="flex rounded-lg border border-line p-0.5 text-xs font-medium">
            {(["write", "preview"] as const).map((value) => (
              <button
                className={`rounded-md px-3 py-1 capitalize transition ${
                  mode === value ? "bg-white/[0.1] text-white" : "text-zinc-400 hover:text-white"
                }`}
                key={value}
                onClick={() => setMode(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {/* Stays mounted in preview mode so the body is still submitted with the form. */}
        <textarea
          aria-label="Body markdown"
          className={`${textareaClass} min-h-[640px] font-mono text-sm leading-6 ${mode === "preview" ? "hidden" : ""}`}
          name="bodyMarkdown"
          onChange={(event) => setBodyMarkdown(event.target.value)}
          required
          value={bodyMarkdown}
        />
        {mode === "preview" ? (
          <article className="min-h-[640px] rounded-lg border border-line bg-[#f8f3eb] px-8 py-7 text-stone-950">
            {bodyMarkdown.trim() ? (
              <div className="prose prose-stone max-w-none prose-headings:font-semibold prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-stone-950 prose-pre:p-4 prose-pre:text-stone-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMarkdown}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Nothing to preview yet.</p>
            )}
          </article>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-line bg-canvas/95 px-1 py-3 backdrop-blur">
        <SubmitButton pendingLabel="Saving...">Save post</SubmitButton>
        <span className="text-xs text-zinc-500">Saving doesn&apos;t publish anything.</span>
      </div>
    </form>
  );
}
