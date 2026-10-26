import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db, formatDate } from "@content-pipeline/db";
import type { Platform, PostStatus } from "@content-pipeline/db";
import { AdminShell, PrimaryLink } from "../components/AdminShell";
import { Menu } from "../components/Menu";
import { platformLabels, postStatusDisplay } from "../components/post-status";
import { SubmitButton } from "../components/SubmitButton";
import {
  EmptyState,
  StatusDot,
  StatusPill,
  Tabs,
  buttonClass,
  menuDangerItemClass,
  relativeTime,
  type PillTone,
} from "../components/ui";
import { clearPipelineQueue } from "./actions";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

const draftStatuses: PostStatus[] = ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY"];
const liveStatuses: PostStatus[] = [
  "PUBLISHED_BLOG",
  "PUBLISHED_DEVTO",
  "PROMOTED_LINKEDIN",
  "PROMOTED_SOCIAL",
  "COMPLETE",
];

const tabs = {
  drafts: {
    label: "Drafts",
    where: { sourcePlatform: null, status: { in: draftStatuses } },
    orderBy: [{ updatedAt: "desc" }],
    empty: "No drafts. Draft one from Ideas, or start a new post.",
  },
  ready: {
    label: "Ready",
    where: { sourcePlatform: null, status: "READY_TO_PUBLISH" },
    orderBy: [{ createdAt: "asc" }],
    empty: "Nothing is ready for review yet.",
  },
  live: {
    label: "Live",
    where: { sourcePlatform: null, status: { in: liveStatuses } },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    empty: "Nothing published from the pipeline yet.",
  },
  archive: {
    label: "Substack archive",
    where: { sourcePlatform: "SUBSTACK" },
    orderBy: [{ publishedAt: "desc" }],
    empty: "No imported posts. Import them from More → Import from Substack.",
  },
} satisfies Record<
  string,
  {
    empty: string;
    label: string;
    orderBy: Prisma.PostOrderByWithRelationInput[];
    where: Prisma.PostWhereInput;
  }
>;

type TabKey = keyof typeof tabs;

const syndicationPlatforms: Platform[] = ["BLOG", "DEVTO", "LINKEDIN", "BLUESKY"];

function publicationTone(status: string | undefined): PillTone {
  switch (status) {
    case "PUBLISHED":
      return "live";
    case "FAILED":
      return "failed";
    case "SCHEDULED":
      return "info";
    case "GENERATED":
      return "pending";
    default:
      return "idle";
  }
}

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  const { tab } = await searchParams;
  const activeTab: TabKey = tab && tab in tabs ? (tab as TabKey) : "drafts";
  const [posts, ...counts] = await Promise.all([
    db.post.findMany({
      where: tabs[activeTab].where,
      orderBy: tabs[activeTab].orderBy,
      include: {
        publications: true,
        _count: { select: { promotionAssets: true } },
      },
    }),
    ...Object.values(tabs).map((item) => db.post.count({ where: item.where })),
  ]);
  const tabKeys = Object.keys(tabs) as TabKey[];

  return (
    <AdminShell
      actions={
        <>
          <PrimaryLink href="/posts/new">New post</PrimaryLink>
          {activeTab === "drafts" || activeTab === "ready" ? (
            <Menu label="⋯" triggerClassName={buttonClass("secondary")}>
              <form action={clearPipelineQueue}>
                <SubmitButton
                  className={menuDangerItemClass}
                  confirm="Delete every pipeline draft and ready post? Published and imported posts are kept."
                  pendingLabel="Clearing..."
                >
                  Clear drafts & ready queue
                </SubmitButton>
              </form>
            </Menu>
          ) : null}
        </>
      }
      title="Posts"
    >
      <Tabs
        items={tabKeys.map((key, index) => ({
          active: key === activeTab,
          count: counts[index],
          href: key === "drafts" ? "/posts" : `/posts?tab=${key}`,
          label: tabs[key].label,
        }))}
      />

      <div className="pt-4">
        {posts.length === 0 ? (
          <EmptyState title={tabs[activeTab].empty} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {posts.map((post) => {
              const status = postStatusDisplay(post.status);
              const publications = new Map(post.publications.map((item) => [item.platform, item.status]));
              const missing =
                activeTab === "drafts" || activeTab === "ready"
                  ? [
                      post.coverImageUrl ? null : "cover",
                      post._count.promotionAssets > 0 ? null : "promo copy",
                    ].filter(Boolean)
                  : [];

              return (
                <li key={post.id}>
                  <Link
                    className="flex items-center gap-4 px-4 py-3 transition hover:bg-white/[0.03]"
                    href={`/posts/${post.id}`}
                  >
                    {post.coverImageUrl ? (
                      <Image
                        alt=""
                        className="hidden aspect-[3/2] w-16 shrink-0 rounded-md border border-line object-cover sm:block"
                        height={44}
                        src={post.coverImageUrl}
                        width={66}
                      />
                    ) : (
                      <div className="hidden aspect-[3/2] w-16 shrink-0 rounded-md border border-dashed border-line-strong sm:block" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{post.title}</p>
                      <p className="mt-0.5 truncate text-sm text-zinc-500">
                        {activeTab === "live" || activeTab === "archive"
                          ? formatDate(post.publishedAt || post.createdAt)
                          : `Edited ${relativeTime(post.updatedAt)}`}
                        {missing.length > 0 ? (
                          <span className="text-amber-300/80"> · needs {missing.join(", ")}</span>
                        ) : null}
                      </p>
                    </div>
                    {activeTab !== "archive" ? (
                      <div className="hidden items-center gap-3 md:flex">
                        {syndicationPlatforms.map((platform) => (
                          <span
                            className="flex items-center gap-1.5 text-xs text-zinc-500"
                            key={platform}
                            title={`${platformLabels[platform]}: ${(publications.get(platform) || "not started").toLowerCase()}`}
                          >
                            <StatusDot tone={publicationTone(publications.get(platform))} />
                            {platformLabels[platform]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="w-24 shrink-0 text-right">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
