import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { db, formatDate, publishedPostStatuses } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await db.post.findFirst({
    where: {
      slug,
      status: {
        in: publishedPostStatuses,
      },
    },
  });

  if (!post) {
    return {};
  }

  return {
    title: `${post.title} | Under The Hood`,
    description: post.description || post.subtitle || undefined,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await db.post.findFirst({
    where: {
      slug,
      status: {
        in: publishedPostStatuses,
      },
    },
  });

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#090909] text-[#f7f2ea]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <nav className="flex items-center justify-between">
          <Link className="text-sm font-semibold text-white" href="/">
            Under The Hood
          </Link>
          <Link className="text-sm font-medium text-orange-400" href="/posts">
            All posts
          </Link>
        </nav>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0 rounded-lg bg-[#f8f3eb] px-6 py-8 text-stone-950 md:px-10">
            <header className="border-b border-stone-200 pb-8">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    className="rounded-md bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800"
                    href={`/topics/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    key={tag}
                  >
                    {tag}
                  </Link>
                ))}
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                {post.title}
              </h1>
              {post.subtitle ? (
                <p className="mt-5 text-xl leading-8 text-stone-700">
                  {post.subtitle}
                </p>
              ) : null}
              <p className="mt-5 text-sm text-stone-500">
                {formatDate(post.publishedAt || post.createdAt)}
              </p>
            </header>

            {post.coverImageUrl ? (
              <Image
                alt=""
                className="mt-8 aspect-video w-full rounded-lg object-cover"
                height={540}
                priority
                src={post.coverImageUrl}
                width={1080}
              />
            ) : null}

            <div className="prose prose-stone mt-10 max-w-none prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-stone-950 prose-pre:p-4 prose-pre:text-stone-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.bodyMarkdown}
              </ReactMarkdown>
            </div>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-4">
              <section className="rounded-lg border border-orange-400/30 bg-[#16110d] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
                  Under The Hood
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  Deep frontend and AI internals.
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  Get practical breakdowns that go beyond surface-level
                  framework docs.
                </p>
                <Link
                  className="mt-4 inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
                  href="/#subscribe"
                >
                  Subscribe
                </Link>
              </section>
              <section className="rounded-lg border border-white/10 bg-[#151515] p-5">
                <p className="text-sm text-zinc-500">Published</p>
                <p className="mt-1 font-semibold text-white">
                  {formatDate(post.publishedAt || post.createdAt)}
                </p>
                <Link
                  className="mt-4 inline-flex text-sm font-semibold text-orange-400"
                  href="/posts"
                >
                  Browse all posts
                </Link>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
