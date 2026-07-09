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
    <main className="min-h-screen bg-[#090909] text-[#f7f2ea]">
      <header className="border-b border-white/10 bg-[#090909]/95">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link className="text-lg font-semibold tracking-tight text-white" href="/">
            Under The Hood
          </Link>
          <div className="flex items-center gap-5 text-sm text-zinc-300">
            <Link className="hover:text-orange-400" href="/posts">
              Posts
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_0.9fr] lg:py-24">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-orange-400">
            Frontend + AI internals
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
            Under the hood of modern frontend and AI.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Deep technical breakdowns for engineers who want the mechanics,
            tradeoffs, and weird browser or AI behavior beneath the abstraction.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-11 items-center justify-center rounded-md bg-orange-500 px-5 text-sm font-semibold text-black transition hover:bg-orange-400"
              href="#subscribe"
            >
              Subscribe
            </a>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/20 px-5 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-300"
              href="/posts"
            >
              Read latest posts
            </Link>
          </div>
        </div>

        <div className="relative min-h-[380px]">
          <div className="hero-card-primary absolute inset-0 rounded-lg border border-orange-400/35 bg-[#16110d] p-6 shadow-2xl shadow-orange-950/30">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-400">
              Technical breakdowns
            </p>
            <h2 className="mt-5 text-3xl font-semibold leading-tight text-white">
              The parts usually skipped in tutorials.
            </h2>
            <div className="mt-8 grid gap-3 text-sm text-zinc-300">
              <div className="rounded-md border border-white/10 bg-black/40 p-4">
                Browser rendering, CSS internals, hydration, storage, and the
                “why did that happen?” layer.
              </div>
              <div className="rounded-md border border-white/10 bg-black/40 p-4">
                AI UX, browser inference, LLM streaming, model tradeoffs, and
                frontend architecture under pressure.
              </div>
            </div>
          </div>

          <div className="hero-card-secondary absolute inset-0 rounded-lg border border-white/10 bg-[#111111] p-6 shadow-2xl shadow-black/40">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-400">
              About the publication
            </p>
            <h2 className="mt-5 text-3xl font-semibold leading-tight text-white">
              Under The Hood is the owned archive for the deep dives.
            </h2>
            <p className="mt-5 text-base leading-7 text-zinc-300">
              Posts start here, syndicate outward to developer platforms, and
              point readers back to a durable newsletter you control.
            </p>
            <div className="mt-8 rounded-md bg-orange-500 p-4 text-sm font-semibold text-black">
              Current archive: 50 imported Substack posts and counting.
            </div>
          </div>
        </div>
      </section>

      <section
        id="subscribe"
        className="border-y border-white/10 bg-[#120f0c]"
      >
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
              Weekly digest
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Get the next deep dive.
            </h2>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="email">
              Email address
            </label>
            <input
              className="h-11 rounded-md border border-white/15 bg-black px-3 text-sm text-white outline-none ring-orange-500/20 placeholder:text-zinc-500 focus:ring-4"
              id="email"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
            <button
              className="h-11 rounded-md bg-orange-500 px-5 text-sm font-semibold text-black transition hover:bg-orange-400"
              type="submit"
            >
              Join the list
            </button>
          </form>
        </div>
      </section>

      <section id="posts" className="bg-[#f8f3eb] text-stone-950">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">
                Latest
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Latest from the archive
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-stone-600">
              The newest entries from the canonical Under The Hood archive.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(posts.length > 0 ? posts : placeholderPosts).map((post) => (
              <article
                className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-orange-400 hover:shadow-lg"
                key={post.title}
              >
                {"coverImageUrl" in post && post.coverImageUrl ? (
                  <Image
                    alt=""
                    className="aspect-video w-full object-cover"
                    height={220}
                    src={post.coverImageUrl}
                    width={390}
                  />
                ) : null}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
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
                </div>
              </article>
            ))}
          </div>
          <Link
            className="mt-8 inline-flex h-10 items-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-900 transition hover:border-orange-500 hover:text-orange-700"
            href="/posts"
          >
            View all posts
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-sm text-zinc-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>Under The Hood</p>
          <p>Canonical home: blog.mspk.me</p>
        </div>
      </footer>
    </main>
  );
}
