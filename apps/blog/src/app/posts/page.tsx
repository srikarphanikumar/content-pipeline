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
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <Link className="text-sm font-medium text-stone-600" href="/">
        Under The Hood
      </Link>
      <header className="mt-10 border-b border-stone-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Archive
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight md:text-6xl">
          All posts
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-700">
          Frontend and AI internals that go past the usual surface layer.
        </p>
      </header>

      <section className="py-10">
        {posts.length === 0 ? (
          <div className="py-12 text-stone-600">
            Imported and newly published posts will show up here.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article
                className="overflow-hidden rounded-lg border border-stone-200 bg-white transition hover:border-stone-400"
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
                    <div className="aspect-video w-full bg-stone-100" />
                  )}
                </Link>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(0, 2).map((tag) => (
                      <Link
                        className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600"
                        href={`/topics/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        key={tag}
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold leading-7 tracking-tight">
                    <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="mt-3 text-sm text-stone-500">
                    {formatDate(post.publishedAt || post.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between border-t border-stone-200 py-8 text-sm">
          {currentPage > 1 ? (
            <Link
              className="rounded-md border border-stone-300 px-4 py-2 font-semibold text-stone-900"
              href={`/posts?page=${currentPage - 1}`}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-stone-600">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              className="rounded-md border border-stone-300 px-4 py-2 font-semibold text-stone-900"
              href={`/posts?page=${currentPage + 1}`}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
