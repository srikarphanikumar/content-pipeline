import { db } from "@content-pipeline/db";
import {
  createDraftPostRecordFromTopic,
  generateNextBacklogTopics,
  interleaveByFocusArea,
  prepareNextSelectedTopicForReview,
  preparePostAssetsForReview,
} from "@/app/topics/pipeline";
import { collectPlatformMetricSnapshots, latestPlatformStatsLines } from "@/lib/analytics";
import { sendBotMessage, sendNextForReview } from "@/lib/pipeline-bot";
import { approvableStatuses } from "@/lib/post-workflow";
import { escapeHtml } from "@/lib/telegram";
import { inactiveTopicStatuses } from "@/lib/topic-status";
import { botFunctions } from "./bot-functions";
import { inngest } from "./client";

const activeTopicTarget = 50;
const draftReadyTarget = 20;
const maxDraftsPerRun = 2;

function truncateLine(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function notificationDate() {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatStatusCounts(counts: {
  failed: number;
  generated?: number;
  published: number;
  scheduled: number;
}) {
  const parts = [
    counts.published > 0 ? pluralize(counts.published, "published") : null,
    counts.scheduled > 0 ? pluralize(counts.scheduled, "scheduled") : null,
    counts.generated ? pluralize(counts.generated, "generated") : null,
    counts.failed > 0 ? `${pluralize(counts.failed, "failure")} to review` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "No activity yet";
}

export const dailyPlanning = inngest.createFunction(
  {
    id: "daily-content-planning",
    triggers: [
      { cron: "TZ=America/New_York 30 5 * * 1-5" },
      { event: "admin/daily-planning.requested" },
    ],
  },
  async ({ step }) => {
    const before = await step.run("Count current pipeline state", async () => {
      const [activeTopicCount, queuePostCount, draftReadyCount] = await Promise.all([
        db.topic.count({
          where: {
            status: {
              notIn: inactiveTopicStatuses,
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
            notIn: inactiveTopicStatuses,
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
    triggers: [
      { cron: "TZ=America/New_York 45 5 * * 1-5" },
      { event: "admin/draft-buffer.requested" },
    ],
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

    const selectedTopics = await step.run("Select topics for draft generation", async () => {
      const candidates = await db.topic.findMany({
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
        select: {
          id: true,
          title: true,
          focusAreaId: true,
        },
      });

      return interleaveByFocusArea(candidates).slice(0, draftsToCreate);
    });

    const createdDraftPostIds: string[] = [];
    const preparedPostIds: string[] = [];

    for (const topic of selectedTopics) {
      const postId = await step.run(`Create draft for ${topic.title}`, async () =>
        createDraftPostRecordFromTopic(topic.id),
      );
      createdDraftPostIds.push(postId);

      await step.run(`Prepare assets for ${topic.title}`, async () =>
        preparePostAssetsForReview(postId),
      );
      preparedPostIds.push(postId);
    }

    return {
      createdDraftPostIds,
      draftReadyCount: before.draftReadyCount,
      draftingCount: before.draftingCount,
      draftReadyTarget,
      preparedPostIds,
      selectedTopicCount: before.selectedTopicCount,
    };
  },
);

export const weekdayMorningApprovalPrep = inngest.createFunction(
  {
    id: "weekday-morning-approval-prep",
    triggers: [
      { cron: "TZ=America/New_York 0 6 * * 1-5" },
      { event: "admin/approval-prep.requested" },
    ],
  },
  async ({ step }) => {
    const existingReadyPost = await step.run("Find existing approval candidate", async () =>
      db.post.findFirst({
        where: {
          status: {
            in: ["DRAFT_READY", "READY_TO_PUBLISH"],
          },
          sourcePlatform: null,
        },
        orderBy: [{ updatedAt: "asc" }],
        select: {
          id: true,
          status: true,
          title: true,
        },
      }),
    );

    if (existingReadyPost) {
      return {
        action: "existing_candidate",
        postId: existingReadyPost.id,
        status: existingReadyPost.status,
        title: existingReadyPost.title,
      };
    }

    const draftingPost = await step.run("Find draft that needs assets", async () =>
      db.post.findFirst({
        where: {
          status: "DRAFTING",
          sourcePlatform: null,
        },
        orderBy: [{ updatedAt: "asc" }],
        select: {
          id: true,
          title: true,
        },
      }),
    );

    if (draftingPost) {
      await step.run(`Prepare existing draft ${draftingPost.title}`, async () =>
        preparePostAssetsForReview(draftingPost.id),
      );

      return {
        action: "prepared_existing_draft",
        postId: draftingPost.id,
        title: draftingPost.title,
      };
    }

    const preparedPostId = await step.run("Prepare next selected topic", async () =>
      prepareNextSelectedTopicForReview(),
    );

    return {
      action: preparedPostId ? "prepared_selected_topic" : "no_selected_topic",
      postId: preparedPostId,
    };
  },
);

// The morning message is the approval card itself: the next post to approve (or a topic to
// draft when the buffer is empty), with a short pipeline status underneath.
export const morningPublishingSummary = inngest.createFunction(
  {
    id: "morning-publishing-summary",
    triggers: [
      { cron: "TZ=America/New_York 45 6 * * 1-5" },
      { event: "admin/morning-summary.requested" },
    ],
  },
  async ({ step }) => {
    const footer = await step.run("Build pipeline status line", async () => {
      const [readyCount, draftingCount, failedCount] = await Promise.all([
        db.post.count({
          where: {
            sourcePlatform: null,
            status: {
              in: approvableStatuses,
            },
          },
        }),
        db.post.count({
          where: {
            status: "DRAFTING",
          },
        }),
        db.platformPublication.count({
          where: {
            status: "FAILED",
          },
        }),
      ]);

      return [
        notificationDate(),
        `Buffer: ${pluralize(readyCount, "ready draft")}, ${draftingCount} in progress`,
        `Failures: ${failedCount > 0 ? `${pluralize(failedCount, "platform action")} to review` : "none"}`,
      ].join("\n");
    });

    return step.run("Send morning approval card", async () =>
      sendNextForReview({ footer, kind: "MORNING_SUMMARY" }),
    );
  },
);

export const nightlyStatsAndTopics = inngest.createFunction(
  {
    id: "nightly-stats-and-topic-prep",
    triggers: [
      { cron: "TZ=America/New_York 0 21 * * 1-5" },
      { event: "admin/nightly-stats.requested" },
    ],
  },
  async ({ step }) => {
    const collectionResult = await step.run("Collect platform metric snapshots", async () =>
      collectPlatformMetricSnapshots(),
    );

    const statsLines = await step.run("Read latest platform stats", async () =>
      latestPlatformStatsLines({ take: 8 }),
    );

    const platformState = await step.run("Read platform delivery state", async () =>
      db.platformPublication.findMany({
        where: {
          platform: {
            in: ["BLOG", "DEVTO", "LINKEDIN", "BLUESKY"],
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
      }),
    );

    const topicState = await step.run("Prepare next-day topic state", async () => {
      const [activeTopicCount, selectedTopics] = await Promise.all([
        db.topic.count({
          where: {
            status: {
              notIn: inactiveTopicStatuses,
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

    const summaryForPlatform = (platform: "BLOG" | "DEVTO" | "LINKEDIN" | "BLUESKY") => {
      const publications = platformState.filter((publication) => publication.platform === platform);

      return formatStatusCounts({
        failed: publications.filter((publication) => publication.status === "FAILED").length,
        generated: publications.filter((publication) => publication.status === "GENERATED").length,
        published: publications.filter((publication) => publication.status === "PUBLISHED").length,
        scheduled: publications.filter((publication) => publication.status === "SCHEDULED").length,
      });
    };
    const failedPublications = platformState.filter(
      (publication) => publication.status === "FAILED",
    );
    const nightlyFailureSummary =
      failedPublications.length > 0
        ? `${pluralize(failedPublications.length, "failure")} needs review: ${truncateLine(
            `${failedPublications[0].platform} - ${failedPublications[0].post.title}`,
            120,
          )}`
        : `None. ${pluralize(collectionResult.metricsStored, "metric")} stored tonight.`;
    const selectedTopicText =
      topicState.selectedTopics.length > 0
        ? topicState.selectedTopics.map((topic) => `- ${topic.title}`).join("\n")
        : "- No selected topics ready for drafting.";
    const text = [
      `📊 <b>Platform report · ${escapeHtml(notificationDate())}</b>`,
      "",
      `Blog: ${escapeHtml(summaryForPlatform("BLOG"))}`,
      `dev.to: ${escapeHtml(summaryForPlatform("DEVTO"))}`,
      `LinkedIn: ${escapeHtml(summaryForPlatform("LINKEDIN"))}`,
      `Bluesky: ${escapeHtml(summaryForPlatform("BLUESKY"))}`,
      `Failed jobs: ${escapeHtml(nightlyFailureSummary)}`,
      "",
      "<b>Latest stats</b>",
      escapeHtml(statsLines.join("\n") || "No stats collected yet."),
      "",
      "<b>Topics for tomorrow</b>",
      escapeHtml(selectedTopicText),
      "",
      `Active topic backlog: ${topicState.activeTopicCount}/${activeTopicTarget}`,
      `Metrics stored: ${collectionResult.metricsStored}`,
    ].join("\n");

    return step.run("Send Telegram nightly stats", async () => ({
      messageId: await sendBotMessage({ kind: "NIGHTLY_STATS", text }),
    }));
  },
);

export const functions = [
  dailyPlanning,
  dailyDraftBuffer,
  weekdayMorningApprovalPrep,
  morningPublishingSummary,
  nightlyStatsAndTopics,
  ...botFunctions,
];
