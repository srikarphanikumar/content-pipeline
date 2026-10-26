import Link from "next/link";
import { db } from "@content-pipeline/db";
import { AdminShell, PrimaryLink } from "./components/AdminShell";
import { platformLabels, postStatusDisplay } from "./components/post-status";
import { SubmitButton } from "./components/SubmitButton";
import {
  ButtonLink,
  Card,
  EmptyState,
  StatusDot,
  StatusPill,
  relativeTime,
  type PillTone,
} from "./components/ui";
import {
  approveAndPublishPost,
  preparePostForReview,
  retryFailedPlatformsForPost,
} from "./posts/actions";
import { continueNewsletterForPost } from "./subscribers/actions";
import { credentialWarnings } from "@/lib/pipeline-bot";
import { approvableStatuses } from "@/lib/post-workflow";

export const dynamic = "force-dynamic";

const oneWeekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

type InboxItem = {
  actions: React.ReactNode;
  detail: React.ReactNode;
  key: string;
  title: React.ReactNode;
  tone: PillTone;
};

export default async function Home() {
  const weekAgo = oneWeekAgo();
  const [
    failedPublications,
    reviewPosts,
    scheduledPublications,
    newsletterDeliveries,
    warnings,
    publishedThisWeek,
    activeReaders,
    recentPosts,
  ] = await Promise.all([
    db.platformPublication.findMany({
      where: { status: "FAILED" },
      include: { post: { select: { id: true, title: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.post.findMany({
      where: { sourcePlatform: null, status: { in: approvableStatuses } },
      include: {
        publications: { where: { platform: "DEVTO" } },
        _count: { select: { promotionAssets: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.platformPublication.findMany({
      where: { platform: "BLOG", status: "SCHEDULED" },
      include: { post: { select: { id: true, title: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    db.emailDelivery.findMany({
      where: { kind: "NEWSLETTER_POST", createdAt: { gte: weekAgo }, postId: { not: null } },
      include: { post: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    credentialWarnings({ withinDays: 7 }),
    db.post.count({ where: { sourcePlatform: null, publishedAt: { gte: weekAgo } } }),
    db.subscriber.count({ where: { status: "ACTIVE" } }),
    db.post.findMany({
      where: { sourcePlatform: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, status: true, title: true, updatedAt: true },
    }),
  ]);

  const items: InboxItem[] = [];

  // Failed platform publishes, one row per post.
  const failedByPost = new Map<string, { title: string; platforms: string[]; error: string | null }>();

  for (const publication of failedPublications) {
    const entry = failedByPost.get(publication.postId) || {
      title: publication.post.title,
      platforms: [],
      error: publication.errorMessage,
    };
    entry.platforms.push(platformLabels[publication.platform] || publication.platform);
    failedByPost.set(publication.postId, entry);
  }

  for (const [postId, failure] of failedByPost) {
    items.push({
      key: `failed-${postId}`,
      tone: "failed",
      title: (
        <>
          {failure.platforms.join(", ")} failed for{" "}
          <Link className="underline decoration-white/20 underline-offset-4 hover:decoration-white" href={`/posts/${postId}`}>
            {failure.title}
          </Link>
        </>
      ),
      detail: failure.error ? <span className="line-clamp-1">{failure.error}</span> : "No error message recorded.",
      actions: (
        <form action={retryFailedPlatformsForPost.bind(null, postId)}>
          <SubmitButton pendingLabel="Retrying..." size="sm" variant="secondary">
            Retry
          </SubmitButton>
        </form>
      ),
    });
  }

  for (const warning of warnings) {
    items.push({
      key: `warning-${warning}`,
      tone: "failed",
      title: warning,
      detail: "Posts to this platform fail until it's fixed.",
      actions: (
        <ButtonLink href="/settings" size="sm">
          Fix in Integrations
        </ButtonLink>
      ),
    });
  }

  // A post's newsletter is unfinished when its latest delivery row is PARTIAL or FAILED.
  const seenNewsletterPosts = new Set<string>();

  for (const delivery of newsletterDeliveries) {
    if (!delivery.postId || !delivery.post || seenNewsletterPosts.has(delivery.postId)) {
      continue;
    }

    seenNewsletterPosts.add(delivery.postId);

    if (delivery.status !== "PARTIAL" && delivery.status !== "FAILED") {
      continue;
    }

    items.push({
      key: `newsletter-${delivery.postId}`,
      tone: "pending",
      title: `Newsletter only partly sent: ${delivery.post.title}`,
      detail: (
        <span className="line-clamp-1">
          {delivery.recipientCount} sent {relativeTime(delivery.createdAt)}.{" "}
          {delivery.errorMessage?.split("\n")[0] || ""}
        </span>
      ),
      actions: (
        <form action={continueNewsletterForPost.bind(null, delivery.postId)}>
          <SubmitButton pendingLabel="Sending..." size="sm" variant="secondary">
            Continue sending
          </SubmitButton>
        </form>
      ),
    });
  }

  for (const post of reviewPosts) {
    const missing = [
      post.coverImageUrl ? null : "cover",
      post.publications[0]?.externalId ? null : "dev.to draft",
      post._count.promotionAssets > 0 ? null : "promo copy",
    ].filter(Boolean);

    items.push(
      missing.length > 0
        ? {
            key: `prepare-${post.id}`,
            tone: "pending",
            title: (
              <Link className="hover:underline" href={`/posts/${post.id}`}>
                {post.title}
              </Link>
            ),
            detail: `Draft needs ${missing.join(", ")} before review.`,
            actions: (
              <form action={preparePostForReview.bind(null, post.id)}>
                <SubmitButton pendingLabel="Preparing..." size="sm" variant="secondary">
                  Prepare
                </SubmitButton>
              </form>
            ),
          }
        : {
            key: `approve-${post.id}`,
            tone: "info",
            title: (
              <Link className="hover:underline" href={`/posts/${post.id}`}>
                {post.title}
              </Link>
            ),
            detail: "Ready for your review.",
            actions: (
              <>
                <ButtonLink href={`/posts/${post.id}`} size="sm">
                  Review
                </ButtonLink>
                <form action={approveAndPublishPost.bind(null, post.id)}>
                  <SubmitButton
                    confirm={`Publish "${post.title}" to the blog, dev.to and socials now?`}
                    pendingLabel="Publishing..."
                    size="sm"
                    variant="success"
                  >
                    Approve & publish
                  </SubmitButton>
                </form>
              </>
            ),
          },
    );
  }

  if (reviewPosts.length === 0 && scheduledPublications.length === 0) {
    items.push({
      key: "empty-queue",
      tone: "pending",
      title: "Nothing is queued for review",
      detail: "Pick or draft an idea so tomorrow's post is ready in time.",
      actions: (
        <ButtonLink href="/topics" size="sm">
          Open ideas
        </ButtonLink>
      ),
    });
  }

  const stats = [
    { label: "Published this week", value: `${publishedThisWeek} / 5` },
    { label: "Waiting for review", value: reviewPosts.length.toString() },
    { label: "Active readers", value: activeReaders.toLocaleString() },
  ];

  return (
    <AdminShell actions={<PrimaryLink href="/posts/new">New post</PrimaryLink>} title="Inbox">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid h-fit grid-cols-1 gap-6">
          {items.length > 0 ? (
            <Card title={`Needs you · ${items.length}`}>
              <ul className="-mx-5 -my-2 divide-y divide-line">
                {items.map((item) => (
                  <li className="flex gap-3 px-5 py-3" key={item.key}>
                    <span className="pt-2">
                      <StatusDot tone={item.tone} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="mt-0.5 text-sm text-zinc-400">{item.detail}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">{item.actions}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState title="Nothing needs you right now">
              The morning jobs and the Telegram bot will flag the next post for review.
            </EmptyState>
          )}

          {scheduledPublications.length > 0 ? (
            <Card title="Coming up">
              <ul className="-mx-5 -my-2 divide-y divide-line">
                {scheduledPublications.map((publication) => (
                  <li className="flex items-center gap-3 px-5 py-3" key={publication.id}>
                    <StatusDot tone="info" />
                    <Link className="min-w-0 flex-1 truncate font-medium text-white hover:underline" href={`/posts/${publication.post.id}`}>
                      {publication.post.title}
                    </Link>
                    <span className="text-sm text-zinc-400">{relativeTime(publication.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="grid h-fit grid-cols-1 gap-6">
          <Card title="This week">
            <dl className="grid gap-3">
              {stats.map((stat) => (
                <div className="flex items-baseline justify-between gap-3" key={stat.label}>
                  <dt className="text-sm text-zinc-400">{stat.label}</dt>
                  <dd className="text-lg font-semibold text-white tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <Link className="mt-4 inline-block text-sm text-zinc-400 hover:text-white" href="/analytics">
              Full analytics →
            </Link>
          </Card>

          <Card title="Recently edited">
            <ul className="-mx-5 -my-2 divide-y divide-line">
              {recentPosts.map((post) => {
                const status = postStatusDisplay(post.status);

                return (
                  <li key={post.id}>
                    <Link className="block px-5 py-2.5 transition hover:bg-white/[0.03]" href={`/posts/${post.id}`}>
                      <p className="truncate text-sm font-medium text-white">{post.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        {relativeTime(post.updatedAt)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>
    </AdminShell>
  );
}
