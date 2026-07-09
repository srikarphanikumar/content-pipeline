import Link from "next/link";
import {
  db,
  formatDate,
  publishedPostStatuses,
  topicSlugToTag,
} from "@content-pipeline/db";

export const dynamic = "force-dynamic";

type TopicPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const tag = topicSlugToTag(slug);
  const posts = await db.post.findMany({
    where: {
      tags: {
        has: tag,
      },
      status: {
        in: publishedPostStatuses,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Link className="text-sm font-medium text-stone-600" href="/posts">
        All posts
      </Link>
      <header className="mt-10 border-b border-stone-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Topic
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">{tag}</h1>
      </header>

      <section className="divide-y divide-stone-200">
        {posts.length === 0 ? (
          <div className="py-12 text-stone-600">
            No published posts for this topic yet.
          </div>
        ) : (
          posts.map((post) => (
            <article className="py-8" key={post.id}>
              <h2 className="text-3xl font-semibold tracking-tight">
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
