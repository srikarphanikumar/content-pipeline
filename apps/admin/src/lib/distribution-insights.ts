import { db } from "@content-pipeline/db";

// Measures whether distribution changes (dev.to tag picking, LinkedIn formats) actually move the
// numbers. Snapshot metrics are cumulative, so each publication's latest value is its total.

type PostMetrics = {
  devToTags: string[];
  devToViews: number;
  devToReactions: number;
  linkedInFormat: string | null;
  linkedInEngagement: number;
  blueskyEngagement: number;
  publishedAt: Date;
};

async function postMetrics(since: Date): Promise<PostMetrics[]> {
  const posts = await db.post.findMany({
    where: {
      sourcePlatform: null,
      publishedAt: { gte: since, lte: new Date() },
    },
    select: {
      devToTags: true,
      linkedInFormat: true,
      publishedAt: true,
      publications: {
        where: { platform: { in: ["DEVTO", "LINKEDIN", "BLUESKY"] }, status: "PUBLISHED" },
        select: {
          platform: true,
          metricSnapshots: {
            orderBy: { capturedAt: "desc" },
            take: 30,
            select: { metricName: true, metricValue: true },
          },
        },
      },
    },
  });

  return posts.map((post) => {
    const latest = (platform: string) => {
      const values = new Map<string, number>();

      for (const snapshot of post.publications.find((item) => item.platform === platform)?.metricSnapshots || []) {
        if (!values.has(snapshot.metricName)) {
          values.set(snapshot.metricName, snapshot.metricValue);
        }
      }

      return values;
    };
    const devTo = latest("DEVTO");
    const linkedIn = latest("LINKEDIN");
    const bluesky = latest("BLUESKY");

    return {
      blueskyEngagement:
        (bluesky.get("likes") || 0) + (bluesky.get("reposts") || 0) + (bluesky.get("replies") || 0),
      devToReactions: devTo.get("reactions") || 0,
      devToTags: post.devToTags,
      devToViews: devTo.get("views") || 0,
      linkedInEngagement: (linkedIn.get("reactions") || 0) + (linkedIn.get("comments") || 0),
      linkedInFormat: post.linkedInFormat,
      publishedAt: post.publishedAt as Date,
    };
  });
}

function totals(posts: PostMetrics[]) {
  return {
    blueskyEngagement: posts.reduce((sum, post) => sum + post.blueskyEngagement, 0),
    devToReactions: posts.reduce((sum, post) => sum + post.devToReactions, 0),
    devToViews: posts.reduce((sum, post) => sum + post.devToViews, 0),
    linkedInEngagement: posts.reduce((sum, post) => sum + post.linkedInEngagement, 0),
    posts: posts.length,
  };
}

export type WeekTotals = ReturnType<typeof totals>;

export async function weekOverWeek(now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const weekAgo = new Date(now.getTime() - 7 * day);
  const posts = await postMetrics(new Date(now.getTime() - 14 * day));

  return {
    lastWeek: totals(posts.filter((post) => post.publishedAt < weekAgo)),
    thisWeek: totals(posts.filter((post) => post.publishedAt >= weekAgo)),
  };
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

// Per-post averages over the last 60 days, grouped three ways. Small samples are shown with
// their post count so a single lucky post isn't mistaken for a trend.
export async function whatsWorking() {
  const posts = await postMetrics(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));
  const groups = <T extends string>(keyOf: (post: PostMetrics) => T[] | T | null) => {
    const grouped = new Map<T, PostMetrics[]>();

    for (const post of posts) {
      const keys = keyOf(post);

      for (const key of Array.isArray(keys) ? keys : keys ? [keys] : []) {
        grouped.set(key, [...(grouped.get(key) || []), post]);
      }
    }

    return grouped;
  };

  const tagFix = groups((post) => (post.devToTags.length > 0 ? "Picked tags" : "Old tags"));
  const formats = groups((post) => post.linkedInFormat);
  const tags = groups((post) => post.devToTags);

  return {
    devToTags: Array.from(tags.entries())
      .map(([tag, items]) => ({ avgViews: average(items.map((item) => item.devToViews)), posts: items.length, tag }))
      .sort((left, right) => right.avgViews - left.avgViews)
      .slice(0, 12),
    linkedInFormats: Array.from(formats.entries())
      .map(([format, items]) => ({
        avgEngagement: average(items.map((item) => item.linkedInEngagement)),
        format,
        posts: items.length,
      }))
      .sort((left, right) => right.avgEngagement - left.avgEngagement),
    tagFix: (["Old tags", "Picked tags"] as const).map((label) => {
      const items = tagFix.get(label) || [];

      return {
        avgReactions: average(items.map((item) => item.devToReactions)),
        avgViews: average(items.map((item) => item.devToViews)),
        label,
        posts: items.length,
      };
    }),
  };
}
