import { db } from "@content-pipeline/db";
import type { Platform } from "@content-pipeline/db";
import {
  fetchLinkedInSocialMetadata,
  hasLinkedInAnalyticsScope,
} from "./linkedin";
import { fetchBlueskyStats, fetchDevToMyArticleStats, fetchDevToStats } from "./platform-stats";

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
    publicationId: string;
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

  // One authenticated listing gives dev.to views for every article. If it fails, fall back to
  // the public endpoint per article (reactions and comments, no views) and say why.
  let devToMine: Map<string, { comments?: number; reactions?: number; views?: number }> | null =
    null;
  let devToMineError: string | null = null;

  if (publications.some((publication) => publication.platform === "DEVTO")) {
    try {
      devToMine = await fetchDevToMyArticleStats();
    } catch (error) {
      devToMineError = error instanceof Error ? error.message : "dev.to listing failed";
    }
  }

  for (const publication of publications) {
    let metrics: Metric[] = [];

    try {
      if (publication.platform === "DEVTO") {
        if (!publication.externalId) {
          skipped.push({
            platform: publication.platform,
            publicationId: publication.id,
            reason: "Missing dev.to article id",
            title: publication.post.title,
          });
          continue;
        }

        const stats =
          devToMine?.get(publication.externalId) ?? (await fetchDevToStats(publication.externalId));

        if (devToMineError && stats) {
          skipped.push({
            platform: publication.platform,
            publicationId: publication.id,
            reason: `Views unavailable: ${devToMineError}`,
            title: publication.post.title,
          });
        }

        if (!stats) {
          skipped.push({
            platform: publication.platform,
            publicationId: publication.id,
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
            publicationId: publication.id,
            reason: "Missing Bluesky post URI",
            title: publication.post.title,
          });
          continue;
        }

        const stats = await fetchBlueskyStats(publication.externalId);

        if (!stats) {
          skipped.push({
            platform: publication.platform,
            publicationId: publication.id,
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
            publicationId: publication.id,
            reason: "Missing LinkedIn post URN",
            title: publication.post.title,
          });
          continue;
        }

        if (!linkedInConnection?.accessToken) {
          skipped.push({
            platform: publication.platform,
            publicationId: publication.id,
            reason: "LinkedIn is not connected",
            title: publication.post.title,
          });
          continue;
        }

        if (!hasLinkedInAnalyticsScope(linkedInConnection.scope)) {
          skipped.push({
            platform: publication.platform,
            publicationId: publication.id,
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
        publicationId: publication.id,
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

export function engagementScore(metrics: Array<{ metricName: string; metricValue: number }>) {
  return metrics.reduce(
    (total, metric) =>
      total + (engagementMetrics.has(metric.metricName) ? metric.metricValue : 0),
    0,
  );
}
