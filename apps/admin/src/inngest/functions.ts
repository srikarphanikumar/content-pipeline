import { db } from "@content-pipeline/db";
import {
  createDraftPostRecordFromTopic,
  generateNextBacklogTopics,
} from "@/app/topics/actions";
import { generateAndStoreCoverImage } from "@/lib/cover-image";
import { fetchBlueskyStats, fetchDevToStats } from "@/lib/platform-stats";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { inngest } from "./client";

const activeTopicTarget = 20;
const draftReadyTarget = 20;
const maxDraftsPerRun = 2;

function adminPostUrl(postId: string) {
  return `https://pipeline.mspk.me/posts/${postId}`;
}

function formatPostLine(post: {
  id: string;
  title: string;
}) {
  return `- ${post.title}\n  ${adminPostUrl(post.id)}`;
}

function notificationDate() {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());
}

export const dailyPlanning = inngest.createFunction(
  {
    id: "daily-content-planning",
    triggers: [{ cron: "0 11 * * *" }],
  },
  async ({ step }) => {
    const before = await step.run("Count current pipeline state", async () => {
      const [activeTopicCount, queuePostCount, draftReadyCount] = await Promise.all([
        db.topic.count({
          where: {
            status: {
              not: "done",
            },
          },
        }),
        db.post.count({
          where: {
            status: {
              in: ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"],
            },
          },
        }),
        db.post.count({
          where: {
            status: {
              in: ["DRAFT_READY", "READY_TO_PUBLISH"],
            },
          },
        }),
      ]);

      return {
        activeTopicCount,
        draftReadyCount,
        queuePostCount,
      };
    });

    if (before.activeTopicCount < activeTopicTarget) {
      await step.run("Top up active topic backlog", async () => {
        await generateNextBacklogTopics();
      });
    }

    const after = await step.run("Count final pipeline state", async () => {
      const activeTopicCount = await db.topic.count({
        where: {
          status: {
            not: "done",
          },
        },
      });

      return {
        activeTopicCount,
      };
    });

    return {
      activeTopicCountAfter: after.activeTopicCount,
      activeTopicCountBefore: before.activeTopicCount,
      draftReadyCount: before.draftReadyCount,
      generatedTopics: before.activeTopicCount < activeTopicTarget,
      queuePostCount: before.queuePostCount,
      topicTarget: activeTopicTarget,
    };
  },
);

export const dailyDraftBuffer = inngest.createFunction(
  {
    id: "daily-draft-buffer",
    triggers: [{ cron: "30 11 * * *" }],
  },
  async ({ step }) => {
    const before = await step.run("Count draft buffer", async () => {
      const [draftReadyCount, selectedTopicCount, draftingCount] = await Promise.all([
        db.post.count({
          where: {
            status: {
              in: ["DRAFT_READY", "READY_TO_PUBLISH"],
            },
          },
        }),
        db.topic.count({
          where: {
            status: "selected",
            posts: {
              none: {},
            },
          },
        }),
        db.post.count({
          where: {
            status: "DRAFTING",
          },
        }),
      ]);

      return {
        draftingCount,
        draftReadyCount,
        selectedTopicCount,
      };
    });

    const draftDeficit = Math.max(0, draftReadyTarget - before.draftReadyCount);
    const draftsToCreate = Math.min(draftDeficit, before.selectedTopicCount, maxDraftsPerRun);

    if (draftsToCreate === 0) {
      return {
        createdDraftPostIds: [],
        draftReadyCount: before.draftReadyCount,
        draftingCount: before.draftingCount,
        draftReadyTarget,
        selectedTopicCount: before.selectedTopicCount,
      };
    }

    const selectedTopics = await step.run("Select topics for draft generation", async () =>
      db.topic.findMany({
        where: {
          status: "selected",
          posts: {
            none: {},
          },
        },
        orderBy: [
          {
            audienceFit: "desc",
          },
          {
            noveltyScore: "desc",
          },
          {
            updatedAt: "asc",
          },
        ],
        take: draftsToCreate,
        select: {
          id: true,
          title: true,
        },
      }),
    );

    const createdDraftPostIds: string[] = [];
    const generatedCoverImages: Array<{ postId: string; coverImageUrl: string }> = [];

    for (const topic of selectedTopics) {
      const postId = await step.run(`Create draft for ${topic.title}`, async () =>
        createDraftPostRecordFromTopic(topic.id),
      );
      createdDraftPostIds.push(postId);

      const coverImageUrl = await step.run(`Generate cover image for ${topic.title}`, async () => {
        const post = await db.post.findUnique({
          where: {
            id: postId,
          },
        });

        if (!post) {
          throw new Error(`Post ${postId} was not found after draft creation.`);
        }

        const generatedUrl = await generateAndStoreCoverImage(post);

        await db.post.update({
          where: {
            id: postId,
          },
          data: {
            coverImageUrl: generatedUrl,
          },
        });

        return generatedUrl;
      });

      generatedCoverImages.push({
        coverImageUrl,
        postId,
      });
    }

    return {
      createdDraftPostIds,
      draftReadyCount: before.draftReadyCount,
      draftingCount: before.draftingCount,
      draftReadyTarget,
      generatedCoverImages,
      selectedTopicCount: before.selectedTopicCount,
    };
  },
);

export const morningPublishingSummary = inngest.createFunction(
  {
    id: "morning-publishing-summary",
    triggers: [{ cron: "0 12 * * *" }],
  },
  async ({ step }) => {
    const summary = await step.run("Build morning publishing summary", async () => {
      const [readyPosts, draftingPosts, recentPublications, failedPublications] =
        await Promise.all([
          db.post.findMany({
            where: {
              status: "READY_TO_PUBLISH",
            },
            orderBy: [{ updatedAt: "asc" }],
            take: 3,
            select: {
              id: true,
              title: true,
            },
          }),
          db.post.findMany({
            where: {
              status: "DRAFTING",
            },
            orderBy: [{ updatedAt: "desc" }],
            take: 5,
            select: {
              id: true,
              title: true,
            },
          }),
          db.platformPublication.findMany({
            where: {
              updatedAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
            include: {
              post: {
                select: {
                  title: true,
                },
              },
            },
            orderBy: [{ updatedAt: "desc" }],
            take: 10,
          }),
          db.platformPublication.findMany({
            where: {
              status: "FAILED",
            },
            include: {
              post: {
                select: {
                  title: true,
                },
              },
            },
            orderBy: [{ updatedAt: "desc" }],
            take: 5,
          }),
        ]);

      return {
        draftingPosts,
        failedPublications,
        readyPosts,
        recentPublications,
      };
    });

    const readyText =
      summary.readyPosts.length > 0
        ? summary.readyPosts.map(formatPostLine).join("\n")
        : "- No posts marked READY_TO_PUBLISH.";
    const draftingText =
      summary.draftingPosts.length > 0
        ? summary.draftingPosts.map(formatPostLine).join("\n")
        : "- No drafts waiting for review.";
    const recentText =
      summary.recentPublications.length > 0
        ? summary.recentPublications
            .map(
              (publication) =>
                `- ${publication.platform}: ${publication.status} · ${publication.post.title}`,
            )
            .join("\n")
        : "- No platform updates in the last 24h.";
    const failuresText =
      summary.failedPublications.length > 0
        ? summary.failedPublications
            .map(
              (publication) =>
                `- ${publication.platform}: ${publication.post.title}\n  ${publication.errorMessage || "No error message"}`,
            )
            .join("\n")
        : "- No failed platform actions.";
    const detail = [
      "Morning pipeline update",
      "",
      "Ready to publish:",
      readyText,
      "",
      "Drafts needing review:",
      draftingText,
      "",
      "Last 24h platform activity:",
      recentText,
      "",
      "Failures:",
      failuresText,
    ].join("\n");
    const body = `Under The Hood morning summary for ${notificationDate()}:\n\n${detail}\n\nReply STOP to opt out.`;

    return step.run("Send WhatsApp morning summary", async () =>
      sendWhatsAppTemplate(
        process.env.TWILIO_MORNING_TEMPLATE_SID,
        {
          "1": notificationDate(),
          "2": detail,
        },
        body,
      ),
    );
  },
);

export const nightlyStatsAndTopics = inngest.createFunction(
  {
    id: "nightly-stats-and-topic-prep",
    triggers: [{ cron: "0 1 * * *" }],
  },
  async ({ step }) => {
    const posts = await step.run("Find published/promoted posts for stats", async () =>
      db.post.findMany({
        where: {
          publications: {
            some: {
              status: "PUBLISHED",
            },
          },
        },
        include: {
          publications: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
      }),
    );

    const statsLines = await step.run("Collect platform stats", async () => {
      const lines: string[] = [];

      for (const post of posts) {
        lines.push(`- ${post.title}`);

        for (const publication of post.publications) {
          if (publication.platform === "DEVTO" && publication.externalId) {
            const stats = await fetchDevToStats(publication.externalId);
            lines.push(
              `  dev.to: ${stats ? `${stats.views ?? "-"} views, ${stats.reactions ?? "-"} reactions, ${stats.comments ?? "-"} comments` : "stats unavailable"}`,
            );
          } else if (publication.platform === "BLUESKY" && publication.externalId) {
            const stats = await fetchBlueskyStats(publication.externalId);
            lines.push(
              `  Bluesky: ${stats ? `${stats.likes ?? "-"} likes, ${stats.reposts ?? "-"} reposts, ${stats.replies ?? "-"} replies, ${stats.quotes ?? "-"} quotes` : "stats unavailable"}`,
            );
          } else if (publication.platform === "LINKEDIN") {
            lines.push(
              `  LinkedIn: ${publication.status}${publication.externalUrl ? ` · ${publication.externalUrl}` : ""} (impressions need LinkedIn analytics permission)`,
            );
          }
        }
      }

      return lines.length > 0 ? lines : ["- No published platform posts found yet."];
    });

    const topicState = await step.run("Prepare next-day topic state", async () => {
      const [activeTopicCount, selectedTopics] = await Promise.all([
        db.topic.count({
          where: {
            status: {
              not: "done",
            },
          },
        }),
        db.topic.findMany({
          where: {
            status: "selected",
            posts: {
              none: {},
            },
          },
          orderBy: [
            {
              audienceFit: "desc",
            },
            {
              noveltyScore: "desc",
            },
            {
              updatedAt: "asc",
            },
          ],
          take: 5,
          select: {
            title: true,
          },
        }),
      ]);

      if (activeTopicCount < activeTopicTarget) {
        await generateNextBacklogTopics();
      }

      return {
        activeTopicCount,
        selectedTopics,
      };
    });

    const selectedTopicText =
      topicState.selectedTopics.length > 0
        ? topicState.selectedTopics.map((topic) => `- ${topic.title}`).join("\n")
        : "- No selected topics ready for drafting.";
    const detail = [
      "Nightly platform stats",
      "",
      statsLines.join("\n"),
      "",
      "Topics for tomorrow:",
      selectedTopicText,
      "",
      `Active topic backlog: ${topicState.activeTopicCount}/${activeTopicTarget}`,
    ].join("\n");
    const body = `Under The Hood nightly stats for ${notificationDate()}:\n\n${detail}\n\nReply STOP to opt out.`;

    return step.run("Send WhatsApp nightly stats", async () =>
      sendWhatsAppTemplate(
        process.env.TWILIO_NIGHTLY_TEMPLATE_SID,
        {
          "1": notificationDate(),
          "2": detail,
        },
        body,
      ),
    );
  },
);

export const functions = [
  dailyPlanning,
  dailyDraftBuffer,
  morningPublishingSummary,
  nightlyStatsAndTopics,
];
