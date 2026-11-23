import { db } from "@content-pipeline/db";
import {
  createDraftPostRecordFromTopic,
  generateNextBacklogTopics,
  interleaveByFocusArea,
  prepareNextSelectedTopicForReview,
  preparePostAssetsForReview,
} from "@/app/topics/pipeline";
import { collectPlatformMetricSnapshots } from "@/lib/analytics";
import { buildNightlyReport } from "@/lib/nightly-report";
import { credentialWarnings, sendBotMessage, sendNextForReview } from "@/lib/pipeline-bot";
import { approvableStatuses } from "@/lib/post-workflow";
import { inactiveTopicStatuses } from "@/lib/topic-status";
import { botFunctions } from "./bot-functions";
import { inngest } from "./client";

const activeTopicTarget = 50;
const draftReadyTarget = 20;
const maxDraftsPerRun = 2;


function notificationDate() {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
      const [readyCount, draftingCount, failedCount, warnings] = await Promise.all([
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
        // Mornings only flag what would break today's Approve; the nightly report warns earlier.
        credentialWarnings({ withinDays: 1 }),
      ]);

      return [
        notificationDate(),
        `Buffer: ${pluralize(readyCount, "ready draft")}, ${draftingCount} in progress`,
        `Failures: ${failedCount > 0 ? `${pluralize(failedCount, "platform action")} to review` : "none"}`,
        ...warnings.map((warning) => `⚠️ ${warning}`),
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
    const collection = await step.run("Collect platform metric snapshots", async () =>
      collectPlatformMetricSnapshots(),
    );

    await step.run("Top up topic backlog", async () => {
      const activeTopicCount = await db.topic.count({
        where: {
          status: {
            notIn: inactiveTopicStatuses,
          },
        },
      });

      if (activeTopicCount < activeTopicTarget) {
        await generateNextBacklogTopics();
      }
    });

    // Built from tonight's snapshots only, so a stat that failed to collect shows the reason
    // instead of last night's number.
    const text = await step.run("Build nightly report", async () =>
      buildNightlyReport({
        capturedAt: new Date(collection.capturedAt),
        skipped: collection.skipped,
      }),
    );

    return step.run("Send Telegram nightly report", async () => ({
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
