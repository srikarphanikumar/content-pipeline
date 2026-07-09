import type { Post, PostStatus } from "@content-pipeline/db";

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

type PostFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  post?: Post;
};

export function PostForm({ action, post }: PostFormProps) {
  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Title
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
          name="title"
          required
          defaultValue={post?.title}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Slug
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
          name="slug"
          placeholder="generated-from-title-if-empty"
          defaultValue={post?.slug}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Subtitle
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
          name="subtitle"
          defaultValue={post?.subtitle || ""}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Description
        <textarea
          className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-slate-950"
          name="description"
          defaultValue={post?.description || ""}
        />
      </label>

      <div className="grid gap-5 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Status
          <select
            className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
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

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Tags
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
            name="tags"
            placeholder="Frontend, AI UX"
            defaultValue={post?.tags.join(", ") || ""}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Published date
          <input
            className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
            name="publishedAt"
            type="date"
            defaultValue={post?.publishedAt?.toISOString().slice(0, 10) || ""}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Canonical URL
        <input
          className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
          name="canonicalUrl"
          placeholder="https://blog.mspk.me/posts/..."
          defaultValue={post?.canonicalUrl || ""}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Body Markdown
        <textarea
          className="min-h-[420px] rounded-md border border-slate-300 px-3 py-3 font-mono text-sm leading-6 text-slate-950"
          name="bodyMarkdown"
          required
          defaultValue={post?.bodyMarkdown || ""}
        />
      </label>

      <button
        className="h-11 w-fit rounded-md bg-slate-950 px-5 text-sm font-semibold text-white"
        type="submit"
      >
        Save post
      </button>
    </form>
  );
}
