import { db } from "@content-pipeline/db";
import { signOut } from "./auth/sign-out/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const queue = [
  {
    title: "Import existing Substack archive",
    status: "Next",
    detail: "Pull RSS/export data, normalize content, review slugs and tags.",
  },
  {
    title: "Publish canonical blog posts",
    status: "Planned",
    detail: "Store posts once and render them on blog.mspk.me.",
  },
  {
    title: "Syndicate to dev.to",
    status: "Planned",
    detail: "Use dev.to API keys to publish technical articles.",
  },
  {
    title: "Generate promotion copy",
    status: "Planned",
    detail: "Create LinkedIn, Bluesky, Mastodon, and first-comment CTAs.",
  },
];

const oneWeekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export default async function Home() {
  const weekStart = oneWeekAgo();
  const [
    readyPosts,
    importedPosts,
    subscribers,
    postsPublishedThisWeek,
  ] = await Promise.all([
    db.post.count({
      where: {
        status: {
          in: ["DRAFT_READY", "READY_TO_PUBLISH"],
        },
      },
    }),
    db.post.count({
      where: {
        sourcePlatform: "SUBSTACK",
      },
    }),
    db.subscriber.count({
      where: {
        status: "ACTIVE",
      },
    }),
    db.post.count({
      where: {
        publishedAt: {
          gte: weekStart,
        },
      },
    }),
  ]);

  const stats = [
    { label: "Ready posts", value: `${readyPosts} / 20`, tone: "Needs attention" },
    { label: "Imported posts", value: `${importedPosts} / 50`, tone: "Substack migration" },
    { label: "This week", value: `${postsPublishedThisWeek} / 5`, tone: "Weekday cadence" },
    { label: "Subscribers", value: subscribers.toString(), tone: "Owned audience" },
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Under The Hood
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Content Pipeline
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-md border border-slate-200 px-3 py-2 text-slate-600">
              MVP
            </span>
            <form action={signOut}>
              <button
                className="rounded-md bg-slate-950 px-3 py-2 font-medium text-white"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <section
              className="rounded-lg border border-slate-200 bg-white p-5"
              key={stat.label}
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {stat.value}
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                {stat.tone}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_0.3fr]">
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500">
                Publishing queue
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Build order from the BRD
              </h2>
            </div>
            <div className="divide-y divide-slate-200">
              {queue.map((item) => (
                <article className="flex gap-4 p-5" key={item.title}>
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                  <div className="flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-semibold">{item.title}</h3>
                      <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.detail}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">
              Operating rule
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Keep 20 posts ready.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The dashboard will flag the buffer whenever ready posts drop
              below the target. The pipeline should generate, review, publish,
              syndicate, and promote from one place.
            </p>
            <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
              Subscriber capture is live on the blog. Review confirmed,
              pending, and unsubscribed readers from the subscriber list.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
                href="/subscribers"
              >
                View subscribers
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700"
                href="/import/substack"
              >
                Import Substack
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
