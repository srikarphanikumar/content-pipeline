import Link from "next/link";
import { db, formatDate } from "@content-pipeline/db";
import type { Platform } from "@content-pipeline/db";
import { SubmitButton } from "../components/SubmitButton";
import { AdminShell } from "../components/AdminShell";
import { collectAnalyticsNow, triggerInngestFunction } from "./actions";
import { engagementScore } from "@/lib/analytics";
import { hasLinkedInAnalyticsScope } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

const trackedPlatforms: Platform[] = [
  "BLOG",
  "DEVTO",
  "MEDIUM",
  "HASHNODE",
  "LINKEDIN",
  "BLUESKY",
];

const thirtyDaysAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

type AnalyticsPageProps = {
  searchParams: Promise<{
    manual?: string;
  }>;
};

function latestMetrics(
  snapshots: Array<{
    capturedAt: Date;
    metricName: string;
    metricValue: number;
  }>,
) {
  const latest = new Map<string, { capturedAt: Date; value: number }>();

  for (const snapshot of snapshots) {
    if (!latest.has(snapshot.metricName)) {
      latest.set(snapshot.metricName, {
        capturedAt: snapshot.capturedAt,
        value: snapshot.metricValue,
      });
    }
  }

  return Array.from(latest.entries())
    .map(([name, metric]) => ({
      capturedAt: metric.capturedAt,
      name,
      value: metric.value,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function metricSummary(metrics: ReturnType<typeof latestMetrics>) {
  if (metrics.length === 0) {
    return "No metrics yet";
  }

  return metrics.map((metric) => `${metric.value} ${metric.name}`).join(", ");
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const { manual } = await searchParams;
  const since = thirtyDaysAgo();
  const [
    totalPublishedPosts,
    totalPublications,
    failedPublications,
    metricSnapshots30d,
    whatsappDeliveries30d,
    linkedInConnection,
    platformCounts,
    recentSnapshots,
    publications,
  ] = await Promise.all([
    db.post.count({
      where: {
        publications: {
          some: {
            status: "PUBLISHED",
          },
        },
      },
    }),
    db.platformPublication.count({
      where: {
        status: "PUBLISHED",
      },
    }),
    db.platformPublication.count({
      where: {
        status: "FAILED",
      },
    }),
    db.platformMetricSnapshot.count({
      where: {
        capturedAt: {
          gte: since,
        },
      },
    }),
    db.notificationDelivery.count({
      where: {
        channel: "WHATSAPP",
        createdAt: {
          gte: since,
        },
      },
    }),
    db.platformConnection.findUnique({
      where: {
        platform: "LINKEDIN",
      },
    }),
    db.platformPublication.groupBy({
      by: ["platform", "status"],
      _count: {
        _all: true,
      },
    }),
    db.platformMetricSnapshot.findMany({
      orderBy: {
        capturedAt: "desc",
      },
      take: 12,
      include: {
        publication: {
          include: {
            post: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
    db.platformPublication.findMany({
      where: {
        status: "PUBLISHED",
      },
      include: {
        metricSnapshots: {
          orderBy: {
            capturedAt: "desc",
          },
          take: 40,
        },
        post: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 80,
    }),
  ]);

  const statusByPlatform = new Map<Platform, Record<string, number>>();
  const linkedInAnalyticsReady = hasLinkedInAnalyticsScope(linkedInConnection?.scope);

  for (const count of platformCounts) {
    const current = statusByPlatform.get(count.platform) || {};
    current[count.status] = count._count._all;
    statusByPlatform.set(count.platform, current);
  }

  const publicationRows = publications.map((publication) => {
    const metrics = latestMetrics(publication.metricSnapshots);

    return {
      engagement: engagementScore(metrics.map((metric) => ({
        metricName: metric.name,
        metricValue: metric.value,
      }))),
      metrics,
      publication,
    };
  });

  const topEngagement = publicationRows
    .filter((row) => row.engagement > 0)
    .sort((left, right) => right.engagement - left.engagement)
    .slice(0, 8);

  const stats = [
    {
      label: "Published posts",
      tone: "with platform records",
      value: totalPublishedPosts.toString(),
    },
    {
      label: "Published placements",
      tone: "all platforms",
      value: totalPublications.toString(),
    },
    {
      label: "Metric snapshots",
      tone: "last 30 days",
      value: metricSnapshots30d.toString(),
    },
    {
      label: "WhatsApp sends",
      tone: "last 30 days",
      value: whatsappDeliveries30d.toString(),
    },
    {
      label: "Platform failures",
      tone: "needs attention",
      value: failedPublications.toString(),
    },
  ];

  return (
    <AdminShell
      description="Track syndication coverage, stored platform metrics, and notification health across the publishing system."
      eyebrow="Measurement"
      title="Analytics"
    >
      {manual ? (
        <div className="mb-6 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-200">
          {manual}
        </div>
      ) : null}

      <section className="mb-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Manual runs
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Trigger pipeline jobs</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Nightly stats runs at 9:00 PM America/New_York on weekdays. Use these controls
              to collect analytics immediately or enqueue an Inngest workflow on demand.
            </p>
          </div>
          <form action={collectAnalyticsNow}>
            <SubmitButton pendingLabel="Collecting analytics...">
              Collect analytics now
            </SubmitButton>
          </form>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              action: triggerInngestFunction.bind(null, "daily-planning"),
              label: "Daily planning",
              pending: "Triggering planning...",
              time: "5:30 AM weekdays",
            },
            {
              action: triggerInngestFunction.bind(null, "draft-buffer"),
              label: "Draft buffer",
              pending: "Triggering buffer...",
              time: "5:45 AM weekdays",
            },
            {
              action: triggerInngestFunction.bind(null, "approval-prep"),
              label: "Approval prep",
              pending: "Triggering prep...",
              time: "6:00 AM weekdays",
            },
            {
              action: triggerInngestFunction.bind(null, "morning-summary"),
              label: "Morning summary",
              pending: "Triggering summary...",
              time: "6:45 AM weekdays",
            },
            {
              action: triggerInngestFunction.bind(null, "nightly-stats"),
              label: "Nightly stats",
              pending: "Triggering stats...",
              time: "9:00 PM weekdays",
            },
          ].map((item) => (
            <form
              action={item.action}
              className="rounded-lg border border-white/10 bg-black/20 p-4"
              key={item.label}
            >
              <p className="font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {item.time}
              </p>
              <div className="mt-4">
                <SubmitButton
                  className="h-9 rounded-md border border-white/15 px-3 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-300 disabled:cursor-wait disabled:opacity-70"
                  pendingLabel={item.pending}
                >
                  Trigger
                </SubmitButton>
              </div>
            </form>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <section
            className="rounded-lg border border-white/10 bg-[#141414] p-4"
            key={stat.label}
          >
            <p className="text-sm text-zinc-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {stat.value}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-400">
              {stat.tone}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
            Coverage
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Platform status</h2>
          <div className="mt-5 divide-y divide-white/10">
            {trackedPlatforms.map((platform) => {
              const counts = statusByPlatform.get(platform) || {};
              const published = counts.PUBLISHED || 0;
              const failed = counts.FAILED || 0;
              const generated = counts.GENERATED || 0;
              const analyticsBlocked = platform === "LINKEDIN" && published > 0 && !linkedInAnalyticsReady;

              return (
                <div
                  className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  key={platform}
                >
                  <div>
                    <p className="font-semibold text-white">{platform}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {published} published, {generated} generated, {failed} failed
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${
                      analyticsBlocked
                        ? "bg-amber-500/15 text-amber-300"
                        : failed > 0
                        ? "bg-amber-500/15 text-amber-300"
                        : published > 0
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/10 text-zinc-400"
                    }`}
                  >
                    {analyticsBlocked
                      ? "Read scope needed"
                      : failed > 0
                        ? "Review"
                        : published > 0
                          ? "Active"
                          : "Waiting"}
                  </span>
                </div>
              );
            })}
          </div>
          {!linkedInAnalyticsReady ? (
            <div className="mt-5 rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
              LinkedIn publishing is connected, but analytics needs a read scope such as
              {" "}
              <code className="rounded bg-black/30 px-1 py-0.5">r_member_social_feed</code>
              {" "}
              or
              {" "}
              <code className="rounded bg-black/30 px-1 py-0.5">r_organization_social_feed</code>.
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
                Top posts
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Stored engagement
              </h2>
            </div>
            <p className="text-sm text-zinc-500">Likes, replies, comments, reposts, quotes.</p>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Post</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Engagement</th>
                  <th className="px-4 py-3">Latest metrics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {topEngagement.length > 0 ? (
                  topEngagement.map((row) => (
                    <tr key={row.publication.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="font-semibold text-white transition hover:text-orange-300"
                          href={`/posts/${row.publication.post.id}`}
                        >
                          {row.publication.post.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{row.publication.platform}</td>
                      <td className="px-4 py-3 text-zinc-300">{row.engagement}</td>
                      <td className="max-w-lg px-4 py-3 text-zinc-400">
                        {metricSummary(row.metrics)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-zinc-500" colSpan={4}>
                      No engagement snapshots collected yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Recent snapshots
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Metric collection log</h2>
          </div>
          <p className="text-sm text-zinc-500">
            Updated by the nightly Inngest analytics step.
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Post</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentSnapshots.length > 0 ? (
                recentSnapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td className="px-4 py-3 text-zinc-400">
                      {formatDate(snapshot.capturedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        className="font-semibold text-white transition hover:text-orange-300"
                        href={`/posts/${snapshot.publication.post.id}`}
                      >
                        {snapshot.publication.post.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{snapshot.platform}</td>
                    <td className="px-4 py-3 text-zinc-300">{snapshot.metricName}</td>
                    <td className="px-4 py-3 text-zinc-300">{snapshot.metricValue}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-zinc-500" colSpan={5}>
                    No metric snapshots recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
