import Link from "next/link";
import { db, formatDate, readyPostStatuses } from "@content-pipeline/db";
import { AdminShell, PrimaryLink, SecondaryLink } from "../components/AdminShell";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{
    status?: string;
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
  const { status } = await searchParams;
  const selectedStatus =
    status && statusFilters.includes(status) && status !== "ALL" ? status : undefined;

  const posts = await db.post.findMany({
    where: selectedStatus
      ? {
          status: selectedStatus as never,
        }
      : undefined,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      publications: true,
      promotionAssets: true,
    },
  });

  const allCounts = await db.post.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });

  const countMap = new Map(allCounts.map((item) => [item.status, item._count.status]));
  const readyCount = posts.filter((post) =>
    readyPostStatuses.includes(post.status),
  ).length;

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
      title="Posts"
    >
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statusFilters.map((item) => {
          const href = item === "ALL" ? "/posts" : `/posts?status=${item}`;
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
            No posts match this view. Create a post or change the filter.
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
