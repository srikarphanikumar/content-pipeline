import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@content-pipeline/db";
import { AdminShell, SecondaryLink } from "../../components/AdminShell";
import { CopyButton } from "../../components/CopyButton";
import { PostForm } from "../PostForm";
import {
  createDevToDraftForPost,
  generateCoverImageForPost,
  generatePromotionAssetsForPost,
  publishBlueskyPromotionForPost,
  publishLinkedInPromotionForPost,
  updatePost,
  updatePromotionAssetsForPost,
} from "../actions";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const post = await db.post.findUnique({
    where: {
      id,
    },
    include: {
      publications: true,
      promotionAssets: true,
    },
  });

  if (!post) {
    notFound();
  }

  const updateAction = updatePost.bind(null, post.id);
  const createDevToDraftAction = createDevToDraftForPost.bind(null, post.id);
  const generateCoverImageAction = generateCoverImageForPost.bind(null, post.id);
  const generatePromotionAction = generatePromotionAssetsForPost.bind(null, post.id);
  const publishLinkedInAction = publishLinkedInPromotionForPost.bind(null, post.id);
  const publishBlueskyAction = publishBlueskyPromotionForPost.bind(null, post.id);
  const updatePromotionAction = updatePromotionAssetsForPost.bind(null, post.id);
  const publicUrl = `https://blog.mspk.me/posts/${post.slug}`;
  const devToPublication = post.publications.find(
    (publication) => publication.platform === "DEVTO",
  );
  const linkedInPublication = post.publications.find(
    (publication) => publication.platform === "LINKEDIN",
  );
  const blueskyPublication = post.publications.find(
    (publication) => publication.platform === "BLUESKY",
  );
  const promotionAssets = new Map(
    post.promotionAssets.map((asset) => [asset.type, asset.content]),
  );
  const linkedInPost = promotionAssets.get("LINKEDIN_POST") || "";
  const linkedInFirstComment = promotionAssets.get("LINKEDIN_FIRST_COMMENT") || "";
  const blueskyPost = promotionAssets.get("BLUESKY_POST") || "";
  const hasPromotionAssets = post.promotionAssets.length > 0;
  const routeSteps = [
    {
      label: "Canonical",
      detail: post.bodyMarkdown.trim() ? "Post body exists" : "Add post body",
      done: Boolean(post.bodyMarkdown.trim()),
    },
    {
      label: "Cover",
      detail: post.coverImageUrl ? "Image ready" : "Generate image",
      done: Boolean(post.coverImageUrl),
    },
    {
      label: "dev.to",
      detail: devToPublication?.externalId ? "Draft created" : "Create draft",
      done: Boolean(devToPublication?.externalId),
    },
    {
      label: "Promo copy",
      detail: hasPromotionAssets ? "Copy ready" : "Generate copy",
      done: hasPromotionAssets,
    },
    {
      label: "LinkedIn",
      detail: linkedInPublication?.status === "PUBLISHED" ? "Posted" : "Not posted",
      done: linkedInPublication?.status === "PUBLISHED",
    },
    {
      label: "Bluesky",
      detail: blueskyPublication?.status === "PUBLISHED" ? "Posted" : "Not posted",
      done: blueskyPublication?.status === "PUBLISHED",
    },
  ];

  return (
    <AdminShell
      actions={
        <>
          <SecondaryLink href="/posts">All posts</SecondaryLink>
          <a
            className="inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
            href={publicUrl}
            rel="noreferrer"
            target="_blank"
          >
            View blog post
          </a>
        </>
      }
      description="Edit the canonical article, create dev.to drafts, and prepare social promotion from one screen."
      eyebrow="Post workspace"
      title={post.title}
    >
      <section className="mb-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Publishing route
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Work left on this post
            </h2>
          </div>
          <p className="text-sm text-zinc-400">
            Move left to right before publishing broadly.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {routeSteps.map((step, index) => (
            <div
              className={`rounded-md border p-3 ${
                step.done
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : "border-white/10 bg-black/30"
              }`}
              key={step.label}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Step {index + 1}
              </p>
              <h3 className="mt-2 font-semibold text-white">{step.label}</h3>
              <p
                className={`mt-1 text-sm ${
                  step.done ? "text-emerald-300" : "text-zinc-400"
                }`}
              >
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="grid h-fit gap-6">
          <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Blog
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Canonical source
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-zinc-300">
              <p>Status: {post.status.replaceAll("_", " ")}</p>
              <p>Slug: {post.slug}</p>
              <p>Tags: {post.tags.length > 0 ? post.tags.join(", ") : "None"}</p>
            </div>
            <div className="mt-5 grid gap-3">
              {post.coverImageUrl ? (
                <Image
                  alt=""
                  className="aspect-video w-full rounded-md border border-white/10 object-cover"
                  height={360}
                  src={post.coverImageUrl}
                  width={640}
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-white/15 bg-black/40 text-sm text-zinc-500">
                  No cover image
                </div>
              )}
              <form action={generateCoverImageAction}>
                <button
                  className="h-10 rounded-md border border-orange-400 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black"
                  type="submit"
                >
                  {post.coverImageUrl ? "Regenerate cover image" : "Generate cover image"}
                </button>
              </form>
              <p className="text-xs leading-5 text-zinc-500">
                Used by the blog, dev.to, and LinkedIn image posts.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
                  dev.to
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Draft syndication
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Creates an unpublished draft with canonical link, CTA, and
                  cover image when available.
                </p>
              </div>
              <span className="w-fit rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                {devToPublication?.status || "NOT_STARTED"}
              </span>
            </div>
            {devToPublication?.errorMessage ? (
              <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-300">
                {devToPublication.errorMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {devToPublication?.externalUrl ? (
                <>
                  <a
                    className="inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-black"
                    href="https://dev.to/dashboard"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open dev.to dashboard
                  </a>
                  <a
                    className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white"
                    href={devToPublication.externalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Public URL after publish
                  </a>
                </>
              ) : (
                <form action={createDevToDraftAction}>
                  <button
                    className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                    type="submit"
                  >
                    Create dev.to draft
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
                Promotion
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Social copy
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Generate LinkedIn and Bluesky copy, edit it, then publish it
                through the connected platform APIs.
              </p>
            </div>
            <form action={generatePromotionAction}>
              <button
                className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                type="submit"
              >
                {hasPromotionAssets ? "Regenerate copy" : "Generate copy"}
              </button>
            </form>
          </div>

          {hasPromotionAssets ? (
            <div className="mt-6 grid gap-6">
              <div className="grid gap-3 rounded-md border border-white/10 bg-black/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">LinkedIn</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {linkedInPublication?.publishedAt
                        ? `Published ${linkedInPublication.publishedAt.toLocaleString()}`
                        : "Posts the saved LinkedIn copy."}
                    </p>
                  </div>
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                    {linkedInPublication?.status || "NOT_STARTED"}
                  </span>
                </div>
                {linkedInPublication?.errorMessage ? (
                  <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
                    {linkedInPublication.errorMessage}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={publishLinkedInAction}>
                    <button
                      className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                      type="submit"
                    >
                      {linkedInPublication?.status === "PUBLISHED"
                        ? "Post again to LinkedIn"
                        : "Post to LinkedIn"}
                    </button>
                  </form>
                  {linkedInPublication?.externalUrl ? (
                    <a
                      className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white"
                      href={linkedInPublication.externalUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open LinkedIn post
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 rounded-md border border-white/10 bg-black/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">Bluesky</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {blueskyPublication?.publishedAt
                        ? `Published ${blueskyPublication.publishedAt.toLocaleString()}`
                        : "Posts the saved Bluesky copy."}
                    </p>
                  </div>
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                    {blueskyPublication?.status || "NOT_STARTED"}
                  </span>
                </div>
                {blueskyPublication?.errorMessage ? (
                  <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
                    {blueskyPublication.errorMessage}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={publishBlueskyAction}>
                    <button
                      className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                      type="submit"
                    >
                      {blueskyPublication?.status === "PUBLISHED"
                        ? "Post again to Bluesky"
                        : "Post to Bluesky"}
                    </button>
                  </form>
                  {blueskyPublication?.externalUrl ? (
                    <a
                      className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white"
                      href={blueskyPublication.externalUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Bluesky post
                    </a>
                  ) : null}
                </div>
              </div>

              <form action={updatePromotionAction} className="grid gap-5">
                {[
                  ["linkedInPost", "LinkedIn post", linkedInPost, "min-h-72"],
                  [
                    "linkedInFirstComment",
                    "LinkedIn first comment",
                    linkedInFirstComment,
                    "min-h-28",
                  ],
                  ["blueskyPost", "Bluesky post", blueskyPost, "min-h-28"],
                ].map(([name, label, value, height]) => (
                  <label
                    className="grid gap-2 text-sm font-semibold text-zinc-300"
                    key={name}
                  >
                    <span className="flex items-center justify-between gap-3">
                      {label}
                      <CopyButton value={value} />
                    </span>
                    <textarea
                      className={`${height} rounded-md border border-white/10 bg-black px-3 py-3 text-sm leading-6 text-white outline-none ring-orange-500/20 focus:ring-4`}
                      maxLength={name === "blueskyPost" ? 300 : undefined}
                      name={name}
                      defaultValue={value}
                    />
                  </label>
                ))}
                <button
                  className="h-10 w-fit rounded-md border border-orange-400 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black"
                  type="submit"
                >
                  Save copy edits
                </button>
              </form>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
          Edit
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Canonical article
        </h2>
        <div className="mt-5">
          <PostForm action={updateAction} post={post} />
        </div>
      </section>
    </AdminShell>
  );
}
