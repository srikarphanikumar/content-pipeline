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

const labelClass = "grid gap-2 text-sm font-semibold text-zinc-300";
const inputClass =
  "h-11 rounded-md border border-white/10 bg-black px-3 text-white outline-none ring-orange-500/20 placeholder:text-zinc-600 focus:ring-4";
const textareaClass =
  "rounded-md border border-white/10 bg-black px-3 py-3 text-white outline-none ring-orange-500/20 placeholder:text-zinc-600 focus:ring-4";

type PostFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  post?: Post;
};

export function PostForm({ action, post }: PostFormProps) {
  const [bodyMarkdown, setBodyMarkdown] = useState(post?.bodyMarkdown || "");

  return (
    <form action={action} className="grid gap-5">
      <label className={labelClass}>
        Title
        <input
          className={inputClass}
          name="title"
          required
          defaultValue={post?.title}
        />
      </label>

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
        Subtitle
        <input
          className={inputClass}
          name="subtitle"
          defaultValue={post?.subtitle || ""}
        />
      </label>

      <label className={labelClass}>
        Description
        <textarea
          className={`${textareaClass} min-h-24`}
          name="description"
          defaultValue={post?.description || ""}
        />
      </label>

      <div className="grid gap-5 md:grid-cols-3">
        <label className={labelClass}>
          Status
          <select
            className={inputClass}
            name="status"
            defaultValue={post?.status || "DRAFT_READY"}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
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

        <label className={labelClass}>
          Published date
          <input
            className={inputClass}
            name="publishedAt"
            type="date"
            defaultValue={post?.publishedAt?.toISOString().slice(0, 10) || ""}
          />
        </label>
      </div>

      <label className={labelClass}>
        Canonical URL
        <input
          className={inputClass}
          name="canonicalUrl"
          placeholder="https://blog.mspk.me/posts/..."
          defaultValue={post?.canonicalUrl || ""}
        />
      </label>

      <section className="grid gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-300">Body Markdown</p>
          <p className="mt-1 text-sm text-zinc-500">
            Edit on the left, read the rendered draft on the right.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-zinc-300">
            Markdown
            <textarea
              className={`${textareaClass} min-h-[680px] font-mono text-sm leading-6`}
              name="bodyMarkdown"
              onChange={(event) => setBodyMarkdown(event.target.value)}
              required
              value={bodyMarkdown}
            />
          </label>
          <div className="grid gap-2 text-sm font-semibold text-zinc-300">
            Preview
            <article className="min-h-[680px] overflow-y-auto rounded-md border border-white/10 bg-[#f8f3eb] px-6 py-6 text-stone-950">
              {bodyMarkdown.trim() ? (
                <div className="prose prose-stone max-w-none prose-headings:font-semibold prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-stone-950 prose-pre:p-4 prose-pre:text-stone-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {bodyMarkdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm font-normal text-stone-500">
                  Start writing to see the rendered post preview.
                </p>
              )}
            </article>
          </div>
        </div>
      </section>

      <SubmitButton
        className="h-11 w-fit rounded-md bg-orange-500 px-5 text-sm font-semibold text-black transition hover:bg-orange-400"
        pendingLabel="Saving..."
      >
        Save post
      </SubmitButton>
    </form>
  );
}
