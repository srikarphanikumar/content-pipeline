import Link from "next/link";
import { db } from "@content-pipeline/db";
import { AdminShell, PrimaryLink, SecondaryLink } from "./components/AdminShell";
import { SubmitButton } from "./components/SubmitButton";
import { collectAnalyticsNow } from "./analytics/actions";

export const dynamic = "force-dynamic";

const oneWeekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export default async function Home() {
  const weekStart = oneWeekAgo();
  const [
    readyPosts,
    importedPosts,
    activeSubscribers,
    postsPublishedThisWeek,
    totalTopics,
    openTopics,
    devToDrafts,
    promotionAssets,
    metricSnapshotsToday,
    latestMetricSnapshot,
    platformFailures,
    recentPosts,
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
    db.topic.count(),
    db.topic.count({
      where: {
        status: {
          not: "done",
        },
      },
    }),
    db.platformPublication.count({
      where: {
        platform: "DEVTO",
        status: "GENERATED",
      },
    }),
    db.promotionAsset.count(),
    db.platformMetricSnapshot.count({
      where: {
        capturedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    db.platformMetricSnapshot.findFirst({
      orderBy: {
        capturedAt: "desc",
      },
      select: {
        capturedAt: true,
      },
    }),
    db.platformPublication.count({
      where: {
        status: "FAILED",
      },
    }),
    db.post.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      include: {
        publications: true,
        promotionAssets: true,
      },
    }),
  ]);

  const stats = [
    { href: "/posts", label: "Ready posts", value: `${readyPosts} / 20`, tone: "Buffer target" },
    { href: "/posts?view=archive", label: "Imported posts", value: `${importedPosts} / 50`, tone: "Archive owned" },
    { href: "/posts", label: "This week", value: `${postsPublishedThisWeek} / 5`, tone: "Publishing pace" },
    { href: "/subscribers", label: "Subscribers", value: activeSubscribers.toString(), tone: "Confirmed readers" },
    { href: "/topics", label: "Open topics", value: `${openTopics} / ${Math.max(totalTopics, 1)}`, tone: "Backlog" },
    { href: "/analytics", label: "Snapshots today", value: metricSnapshotsToday.toString(), tone: "Analytics" },
    { href: "/analytics", label: "Platform failures", value: platformFailures.toString(), tone: "Needs review" },
  ];

  const workflow = [
    {
      title: "Topic backlog",
      detail: "Capture ideas and move the strongest ones into the ready buffer.",
      href: "/topics",
      status: openTopics > 0 ? `${openTopics} open` : "Needs topics",
    },
    {
      title: "Canonical posts",
      detail: "Create or edit owned posts before syndicating anywhere else.",
      href: "/posts",
      status: `${readyPosts} ready`,
    },
    {
      title: "Analytics",
      detail: "Collect latest platform metrics and review what is working across channels.",
      href: "/analytics",
      status: latestMetricSnapshot
        ? `Last ${latestMetricSnapshot.capturedAt.toLocaleDateString()}`
        : "No snapshots",
    },
    {
      title: "dev.to drafts",
      detail: "Create draft syndication posts with canonical links back to the blog.",
      href: "/posts?view=archive",
      status: `${devToDrafts} generated`,
    },
    {
      title: "Promotion",
      detail: "Generate copy, then post image-backed LinkedIn and short-form Bluesky updates.",
      href: "/posts?view=archive",
      status: `${promotionAssets} assets`,
    },
    {
      title: "Owned audience",
      detail: "Review active, pending, and unsubscribed readers.",
      href: "/subscribers",
      status: `${activeSubscribers} active`,
    },
  ];

  return (
    <AdminShell
      actions={
        <>
          <PrimaryLink href="/posts/new">New post</PrimaryLink>
          <SecondaryLink href="/topics">Topic backlog</SecondaryLink>
          <SecondaryLink href="/analytics">Analytics</SecondaryLink>
        </>
      }
      description="Operate the Under The Hood publishing loop from one place: topics, canonical posts, syndication, promotion, and subscribers."
      eyebrow="Pipeline overview"
      title="Content control room"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {stats.map((stat) => (
          <Link
            className="rounded-lg border border-white/10 bg-[#141414] p-4 transition hover:border-orange-400"
            href={stat.href}
            key={stat.label}
          >
            <p className="text-sm text-zinc-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {stat.value}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-400">
              {stat.tone}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Latest stats
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Refresh platform analytics
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Collect fresh dev.to, Bluesky, and permitted LinkedIn metrics before reviewing the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={collectAnalyticsNow}>
              <SubmitButton pendingLabel="Collecting stats...">
                Get latest stats
              </SubmitButton>
            </form>
            <SecondaryLink href="/analytics">Open analytics</SecondaryLink>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
          <div className="border-b border-white/10 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Workflow
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Current operating loop
            </h2>
          </div>
          <div className="divide-y divide-white/10">
            {workflow.map((item) => (
              <Link
                className="grid gap-3 p-5 transition hover:bg-white/[0.03] md:grid-cols-[1fr_auto] md:items-center"
                href={item.href}
                key={item.title}
              >
                <div>
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.detail}</p>
                </div>
                <span className="w-fit rounded-md bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300 ring-1 ring-orange-400/30">
                  {item.status}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
            Recent posts
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Recent workspace activity
          </h2>
          <div className="mt-5 divide-y divide-white/10">
            {recentPosts.length > 0 ? (
              recentPosts.map((post) => {
                const scheduledPublication = post.publications.find(
                  (publication) => publication.status === "SCHEDULED",
                );

                return (
                  <Link
                    className="block py-4 transition hover:text-orange-300"
                    href={`/posts/${post.id}`}
                    key={post.id}
                  >
                    <p className="font-semibold text-white">{post.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-md bg-white/10 px-2 py-1 text-zinc-300">
                        {post.status.replaceAll("_", " ")}
                      </span>
                      {scheduledPublication?.scheduledAt ? (
                        <span className="rounded-md bg-orange-500/15 px-2 py-1 text-orange-300">
                          scheduled {scheduledPublication.scheduledAt.toLocaleDateString()}
                        </span>
                      ) : null}
                      {post.publications.some((publication) => publication.platform === "DEVTO") ? (
                        <span className="rounded-md bg-orange-500 px-2 py-1 text-black">
                          dev.to
                        </span>
                      ) : null}
                      {post.promotionAssets.length > 0 ? (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300">
                          promo
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="py-6 text-sm text-zinc-500">No recent post activity yet.</p>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
