import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@content-pipeline/db";
import type { Platform, PlatformPublication } from "@content-pipeline/db";
import { AdminShell } from "../../components/AdminShell";
import { CopyButton } from "../../components/CopyButton";
import { Menu } from "../../components/Menu";
import { postStatusDisplay } from "../../components/post-status";
import { SubmitButton } from "../../components/SubmitButton";
import {
  Card,
  StatusDot,
  StatusPill,
  Tabs,
  buttonClass,
  menuDangerItemClass,
  menuItemClass,
  relativeTime,
  type PillTone,
} from "../../components/ui";
import { PostForm } from "../PostForm";
import {
  approveAndPublishPost,
  createDevToDraftForPost,
  deletePipelinePost,
  generateCoverImageForPost,
  generatePromotionAssetsForPost,
  preparePostForReview,
  publishBlogCanonicalPost,
  publishBlueskyPromotionForPost,
  publishDevToSyndicationForPost,
  publishLinkedInPromotionForPost,
  publishSyndicationAndSocialsForPost,
  recreateDevToDraftForPost,
  retryFailedPlatformsForPost,
  schedulePostForTomorrow,
  updatePost,
  updatePromotionAssetsForPost,
} from "../actions";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    tab?: string;
  }>;
};

const promoFields = [
  { label: "LinkedIn post", limit: 3000, name: "linkedInPost", rows: 12, type: "LINKEDIN_POST" },
  { label: "LinkedIn first comment", limit: 1250, name: "linkedInFirstComment", rows: 4, type: "LINKEDIN_FIRST_COMMENT" },
  { label: "Bluesky post", limit: 300, name: "blueskyPost", rows: 4, type: "BLUESKY_POST" },
] as const;

function publicationState(publication: PlatformPublication | undefined): { label: string; tone: PillTone } {
  switch (publication?.status) {
    case "PUBLISHED":
      return { label: "Live", tone: "live" };
    case "FAILED":
      return { label: "Failed", tone: "failed" };
    case "SCHEDULED":
      return { label: `Scheduled ${relativeTime(publication.scheduledAt)}`, tone: "info" };
    case "GENERATED":
      return { label: "Draft created", tone: "pending" };
    default:
      return { label: "Not started", tone: "idle" };
  }
}

export default async function EditPostPage({ params, searchParams }: EditPostPageProps) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
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

  const publications = new Map<Platform, PlatformPublication>(
    post.publications.map((publication) => [publication.platform, publication]),
  );
  const blogPublication = publications.get("BLOG");
  const devToPublication = publications.get("DEVTO");
  const promotionAssets = new Map(post.promotionAssets.map((asset) => [asset.type, asset.content]));
  const hasPromotionAssets = post.promotionAssets.length > 0;
  const isProtectedImport = post.sourcePlatform === "SUBSTACK";
  const isPipelineQueuePost = ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"].includes(
    post.status,
  );
  const isBlogPublished =
    blogPublication?.status === "PUBLISHED" ||
    ["PUBLISHED_BLOG", "PUBLISHED_DEVTO", "PROMOTED_LINKEDIN", "PROMOTED_SOCIAL", "COMPLETE"].includes(
      post.status,
    );
  const syndicationPlatforms: Platform[] = ["DEVTO", "LINKEDIN", "BLUESKY"];
  const hasFailedSyndication = syndicationPlatforms.some(
    (platform) => publications.get(platform)?.status === "FAILED",
  );
  const isFullyPublished =
    post.status === "COMPLETE" ||
    (isBlogPublished &&
      syndicationPlatforms.every((platform) => publications.get(platform)?.status === "PUBLISHED"));
  const needsReviewPrep =
    !isProtectedImport &&
    isPipelineQueuePost &&
    (!post.coverImageUrl || !hasPromotionAssets || !devToPublication?.externalId);
  const publicUrl = blogPublication?.externalUrl || post.canonicalUrl || `https://blog.mspk.me/posts/${post.slug}`;
  const status = postStatusDisplay(post.status);
  const activeTab = tab === "promo" ? "promo" : "article";

  // One primary action, chosen by where the post is in its lifecycle.
  let primaryAction: React.ReactNode = null;

  if (isProtectedImport) {
    primaryAction = null;
  } else if (needsReviewPrep) {
    primaryAction = (
      <form action={preparePostForReview.bind(null, post.id)}>
        <SubmitButton pendingLabel="Preparing cover, dev.to, socials...">Prepare for review</SubmitButton>
      </form>
    );
  } else if (!isBlogPublished) {
    primaryAction = (
      <form action={approveAndPublishPost.bind(null, post.id)}>
        <SubmitButton
          confirm="Publish to the blog, dev.to and socials now?"
          pendingLabel="Publishing..."
          variant="success"
        >
          Approve & publish
        </SubmitButton>
      </form>
    );
  } else if (hasFailedSyndication) {
    primaryAction = (
      <form action={retryFailedPlatformsForPost.bind(null, post.id)}>
        <SubmitButton pendingLabel="Retrying...">Retry failed</SubmitButton>
      </form>
    );
  } else if (!isFullyPublished && hasPromotionAssets) {
    primaryAction = (
      <form action={publishSyndicationAndSocialsForPost.bind(null, post.id)}>
        <SubmitButton pendingLabel="Posting...">Post to dev.to & socials</SubmitButton>
      </form>
    );
  }

  const platformRows: Array<{
    action?: React.ReactNode;
    error?: string | null;
    label: string;
    link?: string | null;
    platform: Platform;
  }> = [
    {
      platform: "BLOG",
      label: "Blog",
      link: isBlogPublished ? publicUrl : null,
      error: blogPublication?.errorMessage,
    },
    {
      platform: "DEVTO",
      label: "dev.to",
      link: devToPublication?.externalUrl,
      error: devToPublication?.errorMessage,
      action: isProtectedImport ? null : isBlogPublished && devToPublication?.status !== "PUBLISHED" ? (
        <form action={publishDevToSyndicationForPost.bind(null, post.id)}>
          <SubmitButton pendingLabel="Publishing..." size="sm" variant="ghost">
            Publish
          </SubmitButton>
        </form>
      ) : !devToPublication?.externalId ? (
        <form action={createDevToDraftForPost.bind(null, post.id)}>
          <SubmitButton pendingLabel="Creating..." size="sm" variant="ghost">
            Create draft
          </SubmitButton>
        </form>
      ) : null,
    },
    ...(["LINKEDIN", "BLUESKY"] as const).map((platform) => {
      const publication = publications.get(platform);
      const action = platform === "LINKEDIN" ? publishLinkedInPromotionForPost : publishBlueskyPromotionForPost;

      return {
        platform,
        label: platform === "LINKEDIN" ? "LinkedIn" : "Bluesky",
        link: publication?.externalUrl,
        error: publication?.errorMessage,
        action:
          isBlogPublished && hasPromotionAssets && publication?.status !== "PUBLISHED" ? (
            <form action={action.bind(null, post.id)}>
              <SubmitButton pendingLabel="Posting..." size="sm" variant="ghost">
                Post
              </SubmitButton>
            </form>
          ) : null,
      };
    }),
  ];

  return (
    <AdminShell
      actions={
        <>
          {primaryAction}
          {!isProtectedImport && !isBlogPublished && blogPublication?.status !== "SCHEDULED" ? (
            <form action={schedulePostForTomorrow.bind(null, post.id)}>
              <SubmitButton pendingLabel="Scheduling..." variant="secondary">
                Schedule for tomorrow
              </SubmitButton>
            </form>
          ) : null}
          <Menu label="⋯" triggerClassName={buttonClass("secondary")}>
            {isBlogPublished ? (
              <a className={menuItemClass} href={publicUrl} rel="noreferrer" target="_blank">
                View on blog ↗
              </a>
            ) : null}
            {!isProtectedImport ? (
              <form action={publishBlogCanonicalPost.bind(null, post.id)}>
                <SubmitButton className={menuItemClass} pendingLabel="Publishing...">
                  {isBlogPublished ? "Refresh blog copy" : "Publish to blog only"}
                </SubmitButton>
              </form>
            ) : null}
            {!isProtectedImport && devToPublication?.externalId ? (
              <>
                <a className={menuItemClass} href="https://dev.to/dashboard" rel="noreferrer" target="_blank">
                  dev.to dashboard ↗
                </a>
                <form action={recreateDevToDraftForPost.bind(null, post.id)}>
                  <SubmitButton className={menuItemClass} pendingLabel="Recreating...">
                    Recreate dev.to draft
                  </SubmitButton>
                </form>
              </>
            ) : null}
            {!isProtectedImport && isPipelineQueuePost ? (
              <>
                <div className="my-1 border-t border-line" />
                <form action={deletePipelinePost.bind(null, post.id)}>
                  <SubmitButton
                    className={menuDangerItemClass}
                    confirm={`Delete "${post.title}"? This can't be undone.`}
                    pendingLabel="Deleting..."
                  >
                    Delete post
                  </SubmitButton>
                </form>
              </>
            ) : null}
          </Menu>
        </>
      }
      breadcrumb={
        <Link className="hover:text-white" href="/posts">
          ← Posts
        </Link>
      }
      description={
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {isProtectedImport ? <StatusPill>Imported from Substack</StatusPill> : null}
          <span>Edited {relativeTime(post.updatedAt)}</span>
          {blogPublication?.status === "SCHEDULED" && blogPublication.scheduledAt ? (
            <span>
              · Goes live{" "}
              {blogPublication.scheduledAt.toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/New_York",
              })}{" "}
              ET
            </span>
          ) : null}
        </span>
      }
      title={post.title}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <Tabs
            items={[
              { active: activeTab === "article", href: `/posts/${post.id}`, label: "Article" },
              {
                active: activeTab === "promo",
                count: post.promotionAssets.length || undefined,
                href: `/posts/${post.id}?tab=promo`,
                label: "Promo copy",
              },
            ]}
          />
          <div className="pt-5">
            {activeTab === "article" ? (
              <PostForm action={updatePost.bind(null, post.id)} post={post} />
            ) : (
              <div className="grid gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-zinc-400">
                    LinkedIn and Bluesky copy. The first comment is saved for posting by hand.
                  </p>
                  <form action={generatePromotionAssetsForPost.bind(null, post.id)}>
                    <SubmitButton
                      pendingLabel={hasPromotionAssets ? "Regenerating..." : "Generating..."}
                      size="sm"
                      variant={hasPromotionAssets ? "secondary" : "primary"}
                    >
                      {hasPromotionAssets ? "Regenerate copy" : "Generate copy"}
                    </SubmitButton>
                  </form>
                </div>
                {hasPromotionAssets ? (
                  <form action={updatePromotionAssetsForPost.bind(null, post.id)} className="grid gap-5">
                    {promoFields.map((field) => {
                      const value = promotionAssets.get(field.type) || "";

                      return (
                        <label className="grid gap-2" key={field.name}>
                          <span className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-300">
                            <span>
                              {field.label}
                              <span className="ml-2 text-xs font-normal text-zinc-500 tabular-nums">
                                {value.length}/{field.limit}
                              </span>
                            </span>
                            <CopyButton className={buttonClass("ghost", "sm")} value={value} />
                          </span>
                          <textarea
                            className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm leading-6 text-white outline-none focus:border-zinc-500"
                            defaultValue={value}
                            maxLength={field.limit}
                            name={field.name}
                            rows={field.rows}
                          />
                        </label>
                      );
                    })}
                    <div>
                      <SubmitButton pendingLabel="Saving..." variant="secondary">
                        Save copy
                      </SubmitButton>
                    </div>
                  </form>
                ) : (
                  <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-zinc-400">
                    No promo copy yet. Generate it from the article.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="grid h-fit gap-4">
          <Card>
            {post.coverImageUrl ? (
              <Image
                alt=""
                className="aspect-[3/2] w-full rounded-lg border border-line object-cover"
                height={400}
                src={post.coverImageUrl}
                width={600}
              />
            ) : (
              <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg border border-dashed border-line-strong text-sm text-zinc-500">
                No cover yet
              </div>
            )}
            {!isProtectedImport ? (
              <form action={generateCoverImageForPost.bind(null, post.id)} className="mt-3">
                <SubmitButton
                  pendingLabel={post.coverImageUrl ? "Redrawing..." : "Drawing..."}
                  size="sm"
                  variant="ghost"
                >
                  {post.coverImageUrl ? "↻ Regenerate cover" : "Generate cover"}
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          <Card title="Publishing">
            <ul className="-mx-5 -my-2 divide-y divide-line">
              {platformRows.map((row) => {
                const state =
                  row.platform === "BLOG" && isBlogPublished
                    ? { label: "Live", tone: "live" as const }
                    : publicationState(publications.get(row.platform));

                return (
                  <li className="px-5 py-2.5" key={row.platform}>
                    <div className="flex items-center gap-3">
                      <StatusDot tone={state.tone} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {row.link ? (
                            <a className="hover:underline" href={row.link} rel="noreferrer" target="_blank">
                              {row.label} ↗
                            </a>
                          ) : (
                            row.label
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">{state.label}</p>
                      </div>
                      {row.action}
                    </div>
                    {row.error && state.tone === "failed" ? (
                      <p className="mt-1.5 line-clamp-2 pl-5 text-xs text-red-300" title={row.error}>
                        {row.error}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>

          {!isBlogPublished && !isProtectedImport ? (
            <p className="px-1 text-xs leading-5 text-zinc-500">
              dev.to and socials go out after the blog post is live, so the canonical link always resolves.
            </p>
          ) : null}
        </aside>
      </div>
    </AdminShell>
  );
}
