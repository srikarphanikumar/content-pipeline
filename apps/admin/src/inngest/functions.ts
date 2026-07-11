import { db } from "@content-pipeline/db";
import { generateNextBacklogTopics } from "@/app/topics/actions";
import { inngest } from "./client";

const activeTopicTarget = 20;

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

export const functions = [dailyPlanning];
