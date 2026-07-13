import { db } from "@content-pipeline/db";
import type { Platform } from "@content-pipeline/db";
import {
  fetchLinkedInSocialMetadata,
  hasLinkedInAnalyticsScope,
} from "./linkedin";
import { fetchBlueskyStats, fetchDevToStats } from "./platform-stats";

type Metric = {
  name: string;
  value: number | null | undefined;
};

type CollectionResult = {
  capturedAt: Date;
  metricsStored: number;
  platformsChecked: number;
  publicationsChecked: number;
  skipped: Array<{
    platform: Platform;
    reason: string;
    title: string;
  }>;
};

const engagementMetrics = new Set([
  "comments",
  "likes",
  "quotes",
  "reactions",
  "replies",
  "reposts",
]);

function numericMetrics(metrics: Metric[]) {
  return metrics.filter(
    (metric): metric is { name: string; value: number } =>
      typeof metric.value === "number" && Number.isFinite(metric.value),
  );
}

export async function collectPlatformMetricSnapshots(): Promise<CollectionResult> {
  const capturedAt = new Date();
  const skipped: CollectionResult["skipped"] = [];
  let metricsStored = 0;

  const publications = await db.platformPublication.findMany({
    where: {
      status: "PUBLISHED",
      platform: {
        in: ["DEVTO", "BLUESKY", "LINKEDIN"],
      },
    },
    include: {
      post: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const linkedInConnection = publications.some(
    (publication) => publication.platform === "LINKEDIN",
  )
    ? await db.platformConnection.findUnique({
        where: {
          platform: "LINKEDIN",
        },
      })
    : null;

  for (const publication of publications) {
    let metrics: Metric[] = [];

    try {
      if (publication.platform === "DEVTO") {
        if (!publication.externalId) {
          skipped.push({
            platform: publication.platform,
            reason: "Missing dev.to article id",
            title: publication.post.title,
          });
          continue;
        }

        const stats = await fetchDevToStats(publication.externalId);

        if (!stats) {
          skipped.push({
            platform: publication.platform,
            reason: "dev.to stats unavailable",
            title: publication.post.title,
          });
          continue;
        }

        metrics = [
          { name: "views", value: stats.views },
          { name: "reactions", value: stats.reactions },
          { name: "comments", value: stats.comments },
        ];
      }

      if (publication.platform === "BLUESKY") {
        if (!publication.externalId) {
          skipped.push({
            platform: publication.platform,
            reason: "Missing Bluesky post URI",
            title: publication.post.title,
          });
          continue;
        }

        const stats = await fetchBlueskyStats(publication.externalId);

        if (!stats) {
          skipped.push({
            platform: publication.platform,
            reason: "Bluesky stats unavailable",
            title: publication.post.title,
          });
          continue;
        }

        metrics = [
          { name: "likes", value: stats.likes },
          { name: "reposts", value: stats.reposts },
          { name: "replies", value: stats.replies },
          { name: "quotes", value: stats.quotes },
        ];
      }

      if (publication.platform === "LINKEDIN") {
        if (!publication.externalId) {
          skipped.push({
            platform: publication.platform,
            reason: "Missing LinkedIn post URN",
            title: publication.post.title,
          });
          continue;
        }

        if (!linkedInConnection?.accessToken) {
          skipped.push({
            platform: publication.platform,
            reason: "LinkedIn is not connected",
            title: publication.post.title,
          });
          continue;
        }

        if (!hasLinkedInAnalyticsScope(linkedInConnection.scope)) {
          skipped.push({
            platform: publication.platform,
            reason: "LinkedIn analytics read scope missing",
            title: publication.post.title,
          });
          continue;
        }

        const stats = await fetchLinkedInSocialMetadata({
          accessToken: linkedInConnection.accessToken,
          postUrn: publication.externalId,
        });

        metrics = [
          { name: "comments", value: stats.comments },
          { name: "topLevelComments", value: stats.topLevelComments },
          { name: "reactions", value: stats.reactions },
          ...stats.reactionBreakdown,
        ];
      }
    } catch (error) {
      skipped.push({
        platform: publication.platform,
        reason: error instanceof Error ? error.message : "Stats fetch failed",
        title: publication.post.title,
      });
      continue;
    }

    const values = numericMetrics(metrics);

    for (const metric of values) {
      await db.platformMetricSnapshot.create({
        data: {
          capturedAt,
          metricName: metric.name,
          metricValue: metric.value,
          platform: publication.platform,
          publicationId: publication.id,
        },
      });
      metricsStored += 1;
    }
  }

  return {
    capturedAt,
    metricsStored,
    platformsChecked: new Set(publications.map((publication) => publication.platform)).size,
    publicationsChecked: publications.length,
    skipped,
  };
}

export async function latestPlatformStatsLines(options?: { take?: number }) {
  const publications = await db.platformPublication.findMany({
    where: {
      status: "PUBLISHED",
      platform: {
        in: ["DEVTO", "BLUESKY", "LINKEDIN", "MEDIUM", "HASHNODE"],
      },
    },
    include: {
      metricSnapshots: {
        orderBy: {
          capturedAt: "desc",
        },
        take: 20,
      },
      post: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: options?.take ?? 5,
  });

  if (publications.length === 0) {
    return ["- No published platform posts found yet."];
  }

  return publications.map((publication) => {
    const latestByMetric = new Map<string, number>();

    for (const snapshot of publication.metricSnapshots) {
      if (!latestByMetric.has(snapshot.metricName)) {
        latestByMetric.set(snapshot.metricName, snapshot.metricValue);
      }
    }

    const metricText = Array.from(latestByMetric.entries())
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, value]) => `${value} ${name}`)
      .join(", ");

    return `- ${publication.platform}: ${publication.post.title}${
      metricText ? `\n  ${metricText}` : "\n  Stats not collected yet"
    }`;
  });
}

export function engagementScore(metrics: Array<{ metricName: string; metricValue: number }>) {
  return metrics.reduce(
    (total, metric) =>
      total + (engagementMetrics.has(metric.metricName) ? metric.metricValue : 0),
    0,
  );
}
