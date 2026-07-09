import Link from "next/link";
import Image from "next/image";
import { db, formatDate, publishedPostStatuses } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

const pageSize = 12;

type PostsPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(Number(pageParam || "1") || 1, 1);
  const skip = (currentPage - 1) * pageSize;
  const [posts, totalPosts] = await Promise.all([
    db.post.findMany({
      where: {
        status: {
          in: publishedPostStatuses,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.post.count({
      where: {
        status: {
          in: publishedPostStatuses,
        },
      },
    }),
  ]);
  const totalPages = Math.max(Math.ceil(totalPosts / pageSize), 1);

  return (
    <main className="min-h-screen bg-[#090909] text-[#f7f2ea]">
      <div className="mx-auto max-w-[92rem] px-6 py-10">
        <nav className="flex items-center justify-between">
          <Link className="text-sm font-semibold text-white" href="/">
            Under The Hood
          </Link>
          <Link className="text-sm font-medium text-orange-400" href="/#subscribe">
            Subscribe
          </Link>
        </nav>
        <header className="mt-12 grid gap-6 border-b border-white/10 pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
              Archive
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white md:text-7xl">
              All posts
            </h1>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-zinc-300">
            Fifty imported Under The Hood essays on frontend, browser behavior,
            JavaScript internals, and AI engineering. More coming through the
            pipeline.
          </p>
        </header>

      <section className="py-10">
        {posts.length === 0 ? (
          <div className="py-12 text-zinc-400">
            Imported and newly published posts will show up here.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map((post) => (
              <article
                className="overflow-hidden rounded-lg border border-white/10 bg-[#151515] transition hover:-translate-y-1 hover:border-orange-400 hover:shadow-2xl hover:shadow-orange-950/20"
                key={post.id}
              >
                <Link href={`/posts/${post.slug}`}>
                  {post.coverImageUrl ? (
                    <Image
                      alt=""
                      className="aspect-video w-full object-cover"
                      height={260}
                      src={post.coverImageUrl}
                      width={420}
                    />
                  ) : (
                    <div className="aspect-video w-full bg-zinc-900" />
                  )}
                </Link>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(0, 2).map((tag) => (
                      <Link
                        className="rounded-md bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-300"
                        href={`/topics/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        key={tag}
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold leading-7 tracking-tight text-white">
                    <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="mt-3 text-sm text-zinc-500">
                    {formatDate(post.publishedAt || post.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between border-t border-white/10 py-8 text-sm">
          {currentPage > 1 ? (
            <Link
              className="rounded-md border border-white/15 px-4 py-2 font-semibold text-white transition hover:border-orange-400 hover:text-orange-300"
              href={`/posts?page=${currentPage - 1}`}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-400">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              className="rounded-md border border-white/15 px-4 py-2 font-semibold text-white transition hover:border-orange-400 hover:text-orange-300"
              href={`/posts?page=${currentPage + 1}`}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      </div>
    </main>
  );
}
