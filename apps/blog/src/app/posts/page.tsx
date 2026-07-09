import Link from "next/link";
import Image from "next/image";
import { db, formatDate, publishedPostStatuses } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await db.post.findMany({
    where: {
      status: {
        in: publishedPostStatuses,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Link className="text-sm font-medium text-stone-600" href="/">
        Under The Hood
      </Link>
      <header className="mt-10 border-b border-stone-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Archive
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">
          All posts
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-700">
          Frontend and AI internals that go past the usual surface layer.
        </p>
      </header>

      <section className="divide-y divide-stone-200">
        {posts.length === 0 ? (
          <div className="py-12 text-stone-600">
            Imported and newly published posts will show up here.
          </div>
        ) : (
          posts.map((post) => (
            <article className="py-8" key={post.id}>
              {post.coverImageUrl ? (
                <Image
                  alt=""
                  className="mb-5 aspect-[16/7] w-full rounded-lg object-cover"
                  height={420}
                  src={post.coverImageUrl}
                  width={960}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600"
                    href={`/topics/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    key={tag}
                  >
                    {tag}
                  </Link>
                ))}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                <Link href={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              <p className="mt-3 text-sm text-stone-500">
                {formatDate(post.publishedAt || post.createdAt)}
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-700">
                {post.description || post.subtitle || "Read the full breakdown."}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
