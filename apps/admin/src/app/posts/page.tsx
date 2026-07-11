import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db, formatDate, readyPostStatuses } from "@content-pipeline/db";
import { AdminShell, PrimaryLink, SecondaryLink } from "../components/AdminShell";
import { SubmitButton } from "../components/SubmitButton";
import { clearPipelineQueue, deletePipelinePost } from "./actions";

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
  const queuePostIds = new Set(
    selectedView === "queue"
      ? posts
          .filter((post) => post.sourcePlatform !== "SUBSTACK")
          .map((post) => post.id)
      : [],
  );

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
      <div className="mb-3 flex flex-wrap gap-2">
        {viewTabs.map(([key, label, count, href]) => {
          const active = selectedView === key;

          return (
            <Link
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                active
                  ? "border-orange-400 bg-orange-500 text-black"
                  : "border-white/10 bg-[#141414] text-zinc-300 hover:border-orange-400"
              }`}
              href={String(href)}
              key={String(key)}
            >
              <span>{label}</span>
              <span className={active ? "text-black/70" : "text-zinc-500"}>{count}</span>
            </Link>
          );
        })}
      </div>

      <section className="mb-3 flex flex-wrap gap-2 rounded-lg border border-white/10 bg-[#141414] px-3 py-2">
        {[
          ["1", "Draft", "Write or import the canonical post."],
          ["2", "Cover", "Generate the feed image."],
          ["3", "dev.to", "Create a canonical draft."],
          ["4", "Promote", "Generate social copy."],
          ["5", "Post", "Publish LinkedIn and Bluesky."],
        ].map(([step, label, detail]) => (
          <span
            className="inline-flex h-8 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 text-xs text-zinc-400"
            key={step}
            title={detail}
          >
            <span className="font-semibold text-orange-400">{step}</span>
            <span className="font-semibold text-white">{label}</span>
          </span>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
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
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                active
                  ? "border-orange-400 bg-orange-500 text-black"
                  : "border-white/10 bg-[#141414] text-zinc-300 hover:border-orange-400"
              }`}
              href={href}
              key={item}
            >
              <span>{item.replaceAll("_", " ")}</span>
              <span className={active ? "text-black/70" : "text-zinc-500"}>{count}</span>
            </Link>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
        <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-400">
              Ready buffer
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {readyCount} / 20 posts ready in this view
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-zinc-400">
              Open a row to edit, syndicate, and promote.
            </p>
            {selectedView === "queue" ? (
              <form action={clearPipelineQueue}>
                <SubmitButton
                  className="h-8 rounded-md border border-red-400 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
                  pendingLabel="Clearing..."
                >
                  Clear queue
                </SubmitButton>
              </form>
            ) : null}
          </div>
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
                <article
                  className="grid gap-3 px-4 py-3 transition hover:bg-white/[0.03] xl:grid-cols-[1fr_auto] xl:items-center"
                  key={post.id}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      <Link className="hover:text-orange-300" href={`/posts/${post.id}`}>
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {post.status.replaceAll("_", " ")} ·{" "}
                      {formatDate(post.publishedAt || post.createdAt)}
                    </p>
                    {post.sourcePlatform === "SUBSTACK" ? (
                      <p className="mt-2 w-fit rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                        Protected imported archive
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      className="inline-flex h-8 items-center rounded-md bg-orange-500 px-3 text-xs font-semibold text-black transition hover:bg-orange-400"
                      href={`/posts/${post.id}`}
                    >
                      Open
                    </Link>
                    {queuePostIds.has(post.id) ? (
                      <form action={deletePipelinePost.bind(null, post.id)}>
                        <SubmitButton
                          className="h-8 rounded-md border border-red-400 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
                          pendingLabel="Deleting..."
                        >
                          Delete
                        </SubmitButton>
                      </form>
                    ) : null}
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
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
