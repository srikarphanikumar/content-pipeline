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
    <main className="min-h-screen bg-[#fbfaf7]">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <Link className="text-sm font-medium text-stone-600" href="/posts">
          All posts
        </Link>

        <header className="mt-10 border-b border-stone-200 pb-8">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                className="rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-600"
                href={`/topics/${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                key={tag}
              >
                {tag}
              </Link>
            ))}
          </div>
          <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">
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
            height={420}
            priority
            src={post.coverImageUrl}
            width={960}
          />
        ) : null}

        <div className="prose prose-stone mt-10 max-w-none prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-stone-950 prose-pre:p-4 prose-pre:text-stone-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.bodyMarkdown}
          </ReactMarkdown>
        </div>

        <aside className="mt-12 rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Get the next Under The Hood breakdown
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            I write deeper frontend and AI internals breakdowns without the
            surface-level filler.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white"
            href="/#subscribe"
          >
            Subscribe
          </Link>
        </aside>
      </article>
    </main>
  );
}
