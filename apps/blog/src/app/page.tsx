import Link from "next/link";
import Image from "next/image";
import { db } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

const placeholderPosts = [
  {
    title: "The Hidden Cost of Hydration in AI-Heavy Frontends",
    tag: "Frontend Internals",
    excerpt:
      "A practical look at why AI UI patterns make hydration budgets harder to reason about.",
  },
  {
    title: "Running Models in the Browser Without Wrecking Core Web Vitals",
    tag: "AI in Browser",
    excerpt:
      "What actually happens when client-side inference meets real user performance constraints.",
  },
  {
    title: "Why Streaming LLM Responses Change Your Component Architecture",
    tag: "AI UX",
    excerpt:
      "The UI patterns that emerge when text is not a value, but a timeline.",
  },
];

export default async function Home() {
  const posts = await db.post.findMany({
    where: {
      status: {
        in: ["PUBLISHED_BLOG", "PUBLISHED_DEVTO", "PROMOTED_LINKEDIN", "PROMOTED_SOCIAL", "COMPLETE"],
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 6,
  });

  return (
    <main className="min-h-screen">
      <header className="border-b border-stone-200 bg-[#fbfaf7]/95">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link className="text-lg font-semibold tracking-tight" href="/">
            Under The Hood
          </Link>
          <div className="flex items-center gap-5 text-sm text-stone-700">
            <a href="#posts">Posts</a>
            <a href="#subscribe">Subscribe</a>
            <a href="#about">About</a>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            Frontend + AI internals
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-stone-950 md:text-6xl">
            Technical breakdowns that go past the usual surface layer.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
            Under The Hood explores the frontend and AI topics that are usually
            skipped, simplified, or hidden inside framework abstractions.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-11 items-center justify-center rounded-md bg-stone-950 px-5 text-sm font-semibold text-white"
              href="#subscribe"
            >
              Subscribe
            </a>
            <a
              className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-semibold text-stone-900"
              href="#posts"
            >
              Read latest posts
            </a>
          </div>
        </div>

        <aside
          id="subscribe"
          className="self-start rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
            Weekly digest
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            Get the next deep dive.
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            One practical roundup of frontend and AI internals. No generic
            roundup filler.
          </p>
          <form className="mt-6 space-y-3">
            <label className="sr-only" htmlFor="email">
              Email address
            </label>
            <input
              className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none ring-stone-900/10 focus:ring-4"
              id="email"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
            <button
              className="h-11 w-full rounded-md bg-stone-950 px-4 text-sm font-semibold text-white"
              type="submit"
            >
              Join the list
            </button>
          </form>
          <p className="mt-3 text-xs leading-5 text-stone-500">
            Subscriber storage and confirmation emails are part of the next
            implementation slice.
          </p>
        </aside>
      </section>

      <section id="posts" className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                Latest
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Latest from the archive
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-stone-600">
              Imported Substack posts and new pipeline-published articles live
              here as the canonical Under The Hood archive.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(posts.length > 0 ? posts : placeholderPosts).map((post) => (
              <article
                className="rounded-lg border border-stone-200 p-5 transition hover:border-stone-400"
                key={post.title}
              >
                {"coverImageUrl" in post && post.coverImageUrl ? (
                  <Image
                    alt=""
                    className="mb-5 aspect-video rounded-md object-cover"
                    height={180}
                    src={post.coverImageUrl}
                    width={320}
                  />
                ) : null}
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {"tags" in post && post.tags.length > 0
                    ? post.tags[0]
                    : "tag" in post
                      ? post.tag
                      : "Under The Hood"}
                </p>
                <h3 className="mt-3 text-xl font-semibold leading-7">
                  {"slug" in post ? (
                    <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                  ) : (
                    post.title
                  )}
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {"excerpt" in post
                    ? post.excerpt
                    : (post.description || post.subtitle || "Read the full breakdown.").slice(0, 180)}
                </p>
              </article>
            ))}
          </div>
          <Link
            className="mt-8 inline-flex h-10 items-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-900"
            href="/posts"
          >
            View all posts
          </Link>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Built for engineers who want the real mechanics.
          </h2>
          <p className="mt-4 text-base leading-8 text-stone-700">
            This site will become the owned archive for Under The Hood, with
            dev.to, Medium, LinkedIn, Bluesky, Mastodon, and Hashnode acting as
            distribution channels back to the newsletter.
          </p>
        </div>
      </section>

      <footer className="border-t border-stone-200 px-6 py-8 text-sm text-stone-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>Under The Hood</p>
          <p>Canonical home: blog.mspk.me</p>
        </div>
      </footer>
    </main>
  );
}
