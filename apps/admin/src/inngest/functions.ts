import { db } from "@content-pipeline/db";
import {
  createDraftPostRecordFromTopic,
  generateNextBacklogTopics,
  prepareNextSelectedTopicForReview,
  preparePostAssetsForReview,
} from "@/app/topics/actions";
import { collectPlatformMetricSnapshots, latestPlatformStatsLines } from "@/lib/analytics";
import { pollTwilioMessageStatus, sendWhatsAppTemplate } from "@/lib/whatsapp";
import { inngest } from "./client";

const activeTopicTarget = 50;
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

function assertDelivered(status: {
  errorCode: string | null;
  errorMessage: string | null;
  status: string;
}) {
  if (["failed", "undelivered"].includes(status.status)) {
    throw new Error(
      `WhatsApp delivery ${status.status}${
        status.errorCode ? ` (${status.errorCode})` : ""
      }: ${status.errorMessage || "No Twilio error message"}`,
    );
  }
}

async function recordWhatsAppDelivery(input: {
  bodyPreview: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  kind: "MORNING_SUMMARY" | "NIGHTLY_STATS" | "TEST";
  messageSid?: string | null;
  status: string;
  templateSid?: string;
}) {
  await db.notificationDelivery.create({
    data: {
      bodyPreview: input.bodyPreview,
      channel: "WHATSAPP",
      errorCode: input.errorCode || null,
      errorMessage: input.errorMessage || null,
      kind: input.kind,
      messageSid: input.messageSid || null,
      recipient: process.env.WHATSAPP_TO || "unknown",
      status: input.status,
      templateSid: input.templateSid,
    },
  });
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

export const morningPublishingSummary = inngest.createFunction(
  {
    id: "morning-publishing-summary",
    triggers: [
      { cron: "TZ=America/New_York 45 6 * * 1-5" },
      { event: "admin/morning-summary.requested" },
    ],
  },
  async ({ step }) => {
    const summary = await step.run("Build morning publishing summary", async () => {
      const [readyPosts, draftingPosts, recentPublications, failedPublications] =
        await Promise.all([
          db.post.findMany({
            where: {
              status: {
                in: ["DRAFT_READY", "READY_TO_PUBLISH"],
              },
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
        : "- No posts ready for approval.";
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
    const fullDetail = [
      "Morning pipeline update",
      "",
      "Ready for approval:",
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
    const approvalSummary = summary.readyPosts[0]
      ? `${truncateLine(summary.readyPosts[0].title, 120)} - ${adminPostUrl(summary.readyPosts[0].id)}`
      : "None waiting. Clear runway.";
    const draftBufferSummary = `${pluralize(
      summary.readyPosts.length,
      "ready draft",
    )}, ${pluralize(summary.draftingPosts.length, "draft")} in progress`;
    const failureSummary =
      summary.failedPublications.length > 0
        ? `${pluralize(summary.failedPublications.length, "failure")} needs review`
        : "None. Pipeline is clean.";
    const body = [
      `Pipeline status for ${notificationDate()}.`,
      "",
      `Post awaiting approval: ${approvalSummary}`,
      `Draft buffer: ${draftBufferSummary}`,
      `Failed jobs: ${failureSummary}`,
      "",
      "Reply STOP to opt out.",
    ].join("\n");

    return step.run("Send WhatsApp morning summary", async () => {
      const result = await sendWhatsAppTemplate(
        process.env.TWILIO_MORNING_TEMPLATE_SID,
        {
          "1": notificationDate(),
          "2": approvalSummary,
          "3": draftBufferSummary,
          "4": failureSummary,
        },
        body,
      );

      if (!result.sent) {
        await recordWhatsAppDelivery({
          bodyPreview: `Template body:\n${body}\n\nFull detail:\n${fullDetail}`,
          errorMessage: result.reason,
          kind: "MORNING_SUMMARY",
          status: "not_sent",
          templateSid: process.env.TWILIO_MORNING_TEMPLATE_SID,
        });
        throw new Error(result.reason);
      }

      const status = await pollTwilioMessageStatus(result.sid);

      await recordWhatsAppDelivery({
        bodyPreview: `Template body:\n${body}\n\nFull detail:\n${fullDetail}`,
        errorCode: status.errorCode,
        errorMessage: status.errorMessage,
        kind: "MORNING_SUMMARY",
        messageSid: result.sid,
        status: status.status,
        templateSid: process.env.TWILIO_MORNING_TEMPLATE_SID,
      });
      assertDelivered(status);

      return {
        ...result,
        deliveryStatus: status.status,
      };
    });
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
    const fullDetail = [
      "Nightly platform stats",
      "",
      statsLines.join("\n"),
      "",
      "Topics for tomorrow:",
      selectedTopicText,
      "",
      `Active topic backlog: ${topicState.activeTopicCount}/${activeTopicTarget}`,
      `Metrics stored: ${collectionResult.metricsStored}`,
    ].join("\n");
    const body = [
      `Pipeline platform report for ${notificationDate()}.`,
      "",
      `Blog: ${summaryForPlatform("BLOG")}`,
      `dev.to: ${summaryForPlatform("DEVTO")}`,
      `LinkedIn: ${summaryForPlatform("LINKEDIN")}`,
      `Bluesky: ${summaryForPlatform("BLUESKY")}`,
      `Failed jobs: ${nightlyFailureSummary}`,
      "",
      "Reply STOP to opt out.",
    ].join("\n");

    return step.run("Send WhatsApp nightly stats", async () => {
      const result = await sendWhatsAppTemplate(
        process.env.TWILIO_NIGHTLY_TEMPLATE_SID,
        {
          "1": notificationDate(),
          "2": summaryForPlatform("BLOG"),
          "3": summaryForPlatform("DEVTO"),
          "4": summaryForPlatform("LINKEDIN"),
          "5": summaryForPlatform("BLUESKY"),
          "6": nightlyFailureSummary,
        },
        body,
      );

      if (!result.sent) {
        await recordWhatsAppDelivery({
          bodyPreview: `Template body:\n${body}\n\nFull detail:\n${fullDetail}`,
          errorMessage: result.reason,
          kind: "NIGHTLY_STATS",
          status: "not_sent",
          templateSid: process.env.TWILIO_NIGHTLY_TEMPLATE_SID,
        });
        throw new Error(result.reason);
      }

      const status = await pollTwilioMessageStatus(result.sid);

      await recordWhatsAppDelivery({
        bodyPreview: `Template body:\n${body}\n\nFull detail:\n${fullDetail}`,
        errorCode: status.errorCode,
        errorMessage: status.errorMessage,
        kind: "NIGHTLY_STATS",
        messageSid: result.sid,
        status: status.status,
        templateSid: process.env.TWILIO_NIGHTLY_TEMPLATE_SID,
      });
      assertDelivered(status);

      return {
        ...result,
        deliveryStatus: status.status,
      };
    });
  },
);

export const functions = [
  dailyPlanning,
  dailyDraftBuffer,
  weekdayMorningApprovalPrep,
  morningPublishingSummary,
  nightlyStatsAndTopics,
];
