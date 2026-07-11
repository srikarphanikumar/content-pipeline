import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@content-pipeline/db";
import { AdminShell, SecondaryLink } from "../../components/AdminShell";
import { CopyButton } from "../../components/CopyButton";
import { SubmitButton } from "../../components/SubmitButton";
import { PostForm } from "../PostForm";
import {
  createDevToDraftForPost,
  deletePipelinePost,
  generateCoverImageForPost,
  generatePromotionAssetsForPost,
  publishBlogCanonicalPost,
  publishBlueskyPromotionForPost,
  publishLinkedInPromotionForPost,
  recreateDevToDraftForPost,
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
  const deleteAction = deletePipelinePost.bind(null, post.id);
  const createDevToDraftAction = createDevToDraftForPost.bind(null, post.id);
  const recreateDevToDraftAction = recreateDevToDraftForPost.bind(null, post.id);
  const generateCoverImageAction = generateCoverImageForPost.bind(null, post.id);
  const publishBlogAction = publishBlogCanonicalPost.bind(null, post.id);
  const generatePromotionAction = generatePromotionAssetsForPost.bind(null, post.id);
  const publishLinkedInAction = publishLinkedInPromotionForPost.bind(null, post.id);
  const publishBlueskyAction = publishBlueskyPromotionForPost.bind(null, post.id);
  const updatePromotionAction = updatePromotionAssetsForPost.bind(null, post.id);
  const publicUrl = `https://blog.mspk.me/posts/${post.slug}`;
  const blogPublication = post.publications.find(
    (publication) => publication.platform === "BLOG",
  );
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
  const isProtectedImport = post.sourcePlatform === "SUBSTACK";
  const isPipelineQueuePost = [
    "IDEA",
    "SELECTED",
    "DRAFTING",
    "DRAFT_READY",
    "READY_TO_PUBLISH",
  ].includes(post.status);
  const isBlogPublished =
    blogPublication?.status === "PUBLISHED" ||
    [
      "PUBLISHED_BLOG",
      "PUBLISHED_DEVTO",
      "PROMOTED_LINKEDIN",
      "PROMOTED_SOCIAL",
      "COMPLETE",
    ].includes(post.status);
  const routeSteps = [
    {
      label: "Canonical",
      detail: isBlogPublished
        ? "Live on blog"
        : post.bodyMarkdown.trim()
          ? "Ready to publish"
          : "Add post body",
      done: isBlogPublished,
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

      <section className="mb-6 rounded-lg border border-red-400/30 bg-red-500/10 p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-300">
              Record controls
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {isProtectedImport ? "Protected imported archive" : "Pipeline-owned post"}
            </h2>
            <p className="mt-2 text-sm text-red-100/75">
              {isProtectedImport
                ? "Imported Substack posts cannot be deleted from the admin app."
                : isPipelineQueuePost
                  ? "This post is still in the idea/draft/queue workflow and can be removed if it is no longer useful."
                  : "Published or promoted posts are locked against deletion from this workflow."}
            </p>
          </div>
          {!isProtectedImport && isPipelineQueuePost ? (
            <form action={deleteAction}>
              <SubmitButton
                className="h-10 rounded-md border border-red-400 px-4 text-sm font-semibold text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
                pendingLabel="Deleting..."
              >
                Delete post
              </SubmitButton>
            </form>
          ) : null}
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
              <p>
                Canonical:{" "}
                {isBlogPublished ? (
                  <a
                    className="font-semibold text-orange-300 underline-offset-4 hover:underline"
                    href={blogPublication?.externalUrl || post.canonicalUrl || publicUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Live on blog
                  </a>
                ) : (
                  "Not published"
                )}
              </p>
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
                <SubmitButton
                  className="h-10 rounded-md border border-orange-400 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black"
                  pendingLabel={post.coverImageUrl ? "Regenerating..." : "Generating..."}
                >
                  {post.coverImageUrl ? "Regenerate cover image" : "Generate cover image"}
                </SubmitButton>
              </form>
              <p className="text-xs leading-5 text-zinc-500">
                Used by the blog, dev.to, and LinkedIn image posts.
              </p>
            </div>
            <div className="mt-5 rounded-md border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h3 className="font-semibold text-white">Canonical blog publish</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Make this article visible on blog.mspk.me before syndicating
                    or promoting it elsewhere.
                  </p>
                </div>
                {isProtectedImport ? (
                  <span className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-semibold text-zinc-300">
                    Imported archive
                  </span>
                ) : (
                  <form action={publishBlogAction}>
                    <SubmitButton
                      className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                      pendingLabel={isBlogPublished ? "Refreshing..." : "Publishing..."}
                    >
                      {isBlogPublished ? "Refresh blog publish" : "Publish blog canonical"}
                    </SubmitButton>
                  </form>
                )}
              </div>
              {blogPublication?.errorMessage ? (
                <p className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-300">
                  {blogPublication.errorMessage}
                </p>
              ) : null}
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
              {devToPublication?.externalId || devToPublication?.externalUrl ? (
                <>
                  <a
                    className="inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-black"
                    href="https://dev.to/dashboard"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open dev.to dashboard
                  </a>
                  {devToPublication.externalUrl ? (
                    <a
                      className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white"
                      href={devToPublication.externalUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Public URL after publish
                    </a>
                  ) : null}
                  <form action={recreateDevToDraftAction}>
                    <SubmitButton
                      className="h-10 rounded-md border border-orange-400 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black"
                      pendingLabel="Recreating..."
                    >
                      Recreate dev.to draft
                    </SubmitButton>
                  </form>
                </>
              ) : (
                <form action={createDevToDraftAction}>
                  <SubmitButton
                    className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                    pendingLabel="Creating draft..."
                  >
                    Create dev.to draft
                  </SubmitButton>
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
              <SubmitButton
                className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                pendingLabel={hasPromotionAssets ? "Regenerating..." : "Generating..."}
              >
                {hasPromotionAssets ? "Regenerate copy" : "Generate copy"}
              </SubmitButton>
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
                    <SubmitButton
                      className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                      pendingLabel="Posting..."
                    >
                      {linkedInPublication?.status === "PUBLISHED"
                        ? "Post again to LinkedIn"
                        : "Post to LinkedIn"}
                    </SubmitButton>
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
                    <SubmitButton
                      className="h-10 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                      pendingLabel="Posting..."
                    >
                      {blueskyPublication?.status === "PUBLISHED"
                        ? "Post again to Bluesky"
                        : "Post to Bluesky"}
                    </SubmitButton>
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
                <SubmitButton
                  className="h-10 w-fit rounded-md border border-orange-400 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black"
                  pendingLabel="Saving..."
                >
                  Save copy edits
                </SubmitButton>
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
