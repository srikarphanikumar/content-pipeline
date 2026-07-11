import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db, formatDate, readyPostStatuses } from "@content-pipeline/db";
import { AdminShell, PrimaryLink, SecondaryLink } from "../components/AdminShell";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{
    status?: string;
    view?: string;
  }>;
};

const statusFilters = [
  "ALL",
  "DRAFT_READY",
  "READY_TO_PUBLISH",
  "PUBLISHED_BLOG",
  "PUBLISHED_DEVTO",
  "COMPLETE",
];

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  const { status, view } = await searchParams;
  const selectedView = view === "archive" || view === "all" ? view : "queue";
  const selectedStatus =
    status && statusFilters.includes(status) && status !== "ALL" ? status : undefined;
  const viewWhere: Prisma.PostWhereInput =
    selectedView === "archive"
      ? {
          sourcePlatform: "SUBSTACK",
        }
      : selectedView === "all"
        ? {}
        : {
            status: {
              in: ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"],
            },
          };
  const where: Prisma.PostWhereInput = {
    AND: [
      viewWhere,
      selectedStatus
        ? {
            status: selectedStatus as never,
          }
        : {},
    ],
  };

  const posts = await db.post.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      publications: true,
      promotionAssets: true,
    },
  });

  const allCounts = await db.post.groupBy({
    by: ["status"],
    where: viewWhere,
    _count: {
      status: true,
    },
  });
  const viewCounts = await Promise.all([
    db.post.count({
      where: {
        status: {
          in: ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"],
        },
      },
    }),
    db.post.count({
      where: {
        sourcePlatform: "SUBSTACK",
      },
    }),
    db.post.count(),
  ]);

  const countMap = new Map(allCounts.map((item) => [item.status, item._count.status]));
  const readyCount = posts.filter((post) =>
    readyPostStatuses.includes(post.status),
  ).length;
  const viewTabs = [
    ["queue", "Queue", viewCounts[0], "/posts"],
    ["archive", "Imported archive", viewCounts[1], "/posts?view=archive"],
    ["all", "All posts", viewCounts[2], "/posts?view=all"],
  ];

  return (
    <AdminShell
      actions={
        <>
          <PrimaryLink href="/posts/new">New post</PrimaryLink>
          <SecondaryLink href="/topics">Topics</SecondaryLink>
        </>
      }
      description="Review canonical posts, create dev.to drafts, generate promotion copy, and keep the ready buffer healthy."
      eyebrow="Publishing"
      title={selectedView === "archive" ? "Imported archive" : selectedView === "all" ? "All posts" : "Post queue"}
    >
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {viewTabs.map(([key, label, count, href]) => {
          const active = selectedView === key;

          return (
            <Link
              className={`rounded-lg border p-4 transition ${
                active
                  ? "border-orange-400 bg-orange-500 text-black"
                  : "border-white/10 bg-[#141414] text-zinc-300 hover:border-orange-400"
              }`}
              href={String(href)}
              key={String(key)}
            >
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{count}</p>
            </Link>
          );
        })}
      </div>

      <section className="mb-6 grid gap-3 rounded-lg border border-white/10 bg-[#141414] p-5 lg:grid-cols-5">
        {[
          ["1", "Draft", "Write or import the canonical post."],
          ["2", "Cover", "Generate the feed image."],
          ["3", "dev.to", "Create a canonical draft."],
          ["4", "Promote", "Generate social copy."],
          ["5", "Post", "Publish LinkedIn and Bluesky."],
        ].map(([step, label, detail]) => (
          <div className="rounded-md border border-white/10 bg-black/30 p-3" key={step}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">
              Step {step}
            </p>
            <h2 className="mt-2 font-semibold text-white">{label}</h2>
            <p className="mt-1 text-sm leading-5 text-zinc-400">{detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statusFilters.map((item) => {
          const viewParam = selectedView === "queue" ? "" : `view=${selectedView}`;
          const statusParam = item === "ALL" ? "" : `status=${item}`;
          const params = [viewParam, statusParam].filter(Boolean).join("&");
          const href = params ? `/posts?${params}` : "/posts";
          const active = item === "ALL" ? !selectedStatus : selectedStatus === item;
          const count =
            item === "ALL"
              ? allCounts.reduce((total, count) => total + count._count.status, 0)
              : countMap.get(item as never) || 0;

          return (
            <Link
              className={`rounded-lg border p-4 transition ${
                active
                  ? "border-orange-400 bg-orange-500 text-black"
                  : "border-white/10 bg-[#141414] text-zinc-300 hover:border-orange-400"
              }`}
              href={href}
              key={item}
            >
              <p className="text-sm font-semibold">{item.replaceAll("_", " ")}</p>
              <p className="mt-2 text-2xl font-semibold">{count}</p>
            </Link>
          );
        })}
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
        <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-5 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Ready buffer
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {readyCount} / 20 posts ready in this view
            </h2>
          </div>
          <p className="text-sm text-zinc-400">
            Select a row to edit, syndicate, and generate promotion copy.
          </p>
        </div>
        {posts.length === 0 ? (
          <div className="p-8 text-zinc-400">
            {selectedView === "queue"
              ? "No queued posts yet. Use Ideas to build the next backlog, then create drafts from selected topics."
              : "No posts match this view. Change the filter or switch views."}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {posts.map((post) => {
              const devToPublication = post.publications.find(
                (publication) => publication.platform === "DEVTO",
              );
              return (
                <Link
                  className="grid gap-4 p-5 transition hover:bg-white/[0.03] xl:grid-cols-[1fr_auto] xl:items-center"
                  href={`/posts/${post.id}`}
                  key={post.id}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white">{post.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      {post.status.replaceAll("_", " ")} ·{" "}
                      {formatDate(post.publishedAt || post.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {devToPublication ? (
                      <span className="rounded-md bg-orange-500 px-2 py-1 text-xs font-semibold text-black">
                        dev.to {devToPublication.status}
                      </span>
                    ) : (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                        dev.to not started
                      </span>
                    )}
                    {post.promotionAssets.length > 0 ? (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                        promo ready
                      </span>
                    ) : (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                        promo needed
                      </span>
                    )}
                    {post.coverImageUrl ? (
                      <span className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-300">
                        image ready
                      </span>
                    ) : (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300">
                        image needed
                      </span>
                    )}
                    {post.tags.slice(0, 2).map((tag) => (
                      <span
                        className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
