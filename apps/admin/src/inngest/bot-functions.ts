import { db } from "@content-pipeline/db";
import {
  createDraftPostRecordFromTopic,
  preparePostAssetsForReview,
} from "@/app/topics/pipeline";
import {
  approvalCardMessageIds,
  botHelpText,
  draftNowKeyboard,
  findCardPost,
  findPendingImprovePrompt,
  publishResultCard,
  sendApprovalCard,
  sendBotMessage,
  sendNextForReview,
  sendTopicOffer,
  topicOfferKeyboard,
  type BotAction,
} from "@/lib/pipeline-bot";
import {
  approvableStatuses,
  approveAndPublishPost,
  improvePostWithFeedback,
  publicationResults,
  queueStatuses,
  rejectPost,
  retryFailedPlatforms,
  syncDraftAssetsAfterEdit,
} from "@/lib/post-workflow";
import {
  clearTelegramKeyboard,
  editTelegramMessage,
  escapeHtml,
  truncateText,
} from "@/lib/telegram";
import { isActiveTopicStatus } from "@/lib/topic-status";
import { inngest } from "./client";

// Events sent by /api/telegram/webhook. Each event id is the Telegram update id, so a
// redelivered update never runs twice.
type ButtonTappedData = {
  action: BotAction;
  messageId: number;
  targetId: string;
};

type FeedbackReceivedData = {
  feedback: string | null;
  messageId: number;
  replyToMessageId: number | null;
};

type CommandReceivedData = {
  args?: string;
  command: string;
  messageId?: number;
};

const actionLabels: Record<BotAction, string> = {
  approve: "Approve",
  draft: "Draft",
  improve: "Improve",
  reject: "Reject",
  retry: "Retry",
  skip: "Skip",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

function bold(value: string) {
  return `<b>${escapeHtml(value)}</b>`;
}

// /next or an Improve round can leave several cards for one post. Once the post is handled,
// strip the buttons from the others so a stale tap is not even possible.
async function retireOtherCards(postId: string, exceptMessageId?: number) {
  const messageIds = await approvalCardMessageIds(postId);

  await Promise.all(
    messageIds
      .filter((messageId) => messageId !== exceptMessageId)
      .map((messageId) =>
        clearTelegramKeyboard(messageId).catch((error) =>
          console.error("Failed to retire Telegram card", error),
        ),
      ),
  );
}

async function retireStaleCard(messageId: number, note: string) {
  await clearTelegramKeyboard(messageId).catch(() => undefined);
  await sendBotMessage({
    kind: "BOT_REPLY",
    replyToMessageId: messageId,
    text: `ℹ️ ${escapeHtml(note)}`,
  });
}

// retries: 0 everywhere here. Approve publishes to external platforms and Improve spends
// OpenAI tokens; a failed run reports back in the chat instead of silently trying again.
export const telegramButtonTapped = inngest.createFunction(
  {
    concurrency: {
      key: "event.data.targetId",
      limit: 1,
    },
    id: "telegram-button-tapped",
    retries: 0,
    triggers: [{ event: "telegram/button.tapped" }],
  },
  async ({ event, step }) => {
    const { action, messageId, targetId } = event.data as ButtonTappedData;

    try {
      if (action === "retry") {
        const state = await step.run("Check failed platforms", async () => {
          const post = await findCardPost(targetId);

          if (!post) {
            return null;
          }

          const results = await publicationResults(targetId);

          return {
            failedCount: results.filter((result) => result.status === "FAILED").length,
            id: post.id,
            title: post.title,
          };
        });

        if (!state || state.failedCount === 0) {
          await step.run("Retire stale card", async () =>
            retireStaleCard(
              messageId,
              state ? `Nothing left to retry for “${state.title}”.` : "That post no longer exists.",
            ),
          );

          return { action, skipped: "stale" };
        }

        await step.run("Mark card as retrying", async () =>
          editTelegramMessage({
            messageId,
            text: `⏳ ${bold("Retrying failed platforms…")}\n\n${bold(state.title)}`,
          }),
        );
        await step.run("Retry failed platforms", async () => retryFailedPlatforms(state.id));

        const results = await step.run("Read publish results", async () =>
          publicationResults(state.id),
        );

        await step.run("Show publish results", async () =>
          editTelegramMessage({
            messageId,
            ...publishResultCard(state, results, `🔁 ${bold("Retried")}`),
          }),
        );

        return { action, postId: state.id };
      }

      if (action === "approve" || action === "improve" || action === "reject") {
        const post = await step.run("Check post state", async () => findCardPost(targetId));
        const allowedStatuses = action === "approve" ? approvableStatuses : queueStatuses;

        if (!post || post.sourcePlatform || !allowedStatuses.includes(post.status)) {
          await step.run("Retire stale card", async () =>
            retireStaleCard(
              messageId,
              post
                ? `“${post.title}” was already handled (status: ${post.status}).`
                : "That post no longer exists.",
            ),
          );

          return { action, skipped: "stale" };
        }

        if (action === "approve") {
          await step.run("Mark card as publishing", async () =>
            editTelegramMessage({
              messageId,
              text: `⏳ ${bold("Publishing…")}\n\n${bold(post.title)}`,
            }),
          );
          await step.run("Retire other cards", async () => retireOtherCards(post.id, messageId));
          await step.run("Approve and publish", async () => approveAndPublishPost(post.id));

          const results = await step.run("Read publish results", async () =>
            publicationResults(post.id),
          );

          await step.run("Show publish results", async () =>
            editTelegramMessage({
              messageId,
              ...publishResultCard(post, results, `🚀 ${bold("Approved")}`),
            }),
          );

          return { action, postId: post.id };
        }

        if (action === "improve") {
          await step.run("Ask for feedback", async () =>
            sendBotMessage({
              forceReplyPlaceholder: "What should change?",
              kind: "IMPROVE_PROMPT",
              postId: post.id,
              replyToMessageId: messageId,
              text: [
                `✏️ What should change in ${bold(post.title)}?`,
                "",
                "Reply to this message with your notes, or send /polish for a general editing pass.",
              ].join("\n"),
            }),
          );

          return { action, postId: post.id };
        }

        await step.run("Reject post", async () => rejectPost(post.id));
        await step.run("Mark card as rejected", async () =>
          editTelegramMessage({
            messageId,
            text: [
              `❌ ${bold("Rejected")}`,
              "",
              `<s>${escapeHtml(post.title)}</s>`,
              "",
              "The draft is deleted and its topic won't be suggested again.",
            ].join("\n"),
          }),
        );
        await step.run("Retire other cards", async () => retireOtherCards(post.id, messageId));
        await step.run("Send next for review", async () => sendNextForReview());

        return { action, postId: post.id };
      }

      const topic = await step.run("Check topic state", async () =>
        db.topic.findUnique({
          where: {
            id: targetId,
          },
          select: {
            id: true,
            posts: {
              select: {
                id: true,
              },
              take: 1,
            },
            status: true,
            title: true,
          },
        }),
      );

      if (!topic || !isActiveTopicStatus(topic.status)) {
        await step.run("Retire stale card", async () =>
          retireStaleCard(messageId, "That topic is no longer in the backlog."),
        );

        return { action, skipped: "stale" };
      }

      if (action === "skip") {
        await step.run("Mark card as skipped", async () =>
          editTelegramMessage({
            messageId,
            text: `⏭ Skipped: ${escapeHtml(topic.title)}`,
          }),
        );

        const nextTopicId = await step.run("Offer next topic", async () => sendTopicOffer(topic.id));

        if (!nextTopicId) {
          await step.run("Say no more topics", async () =>
            sendBotMessage({
              kind: "BOT_REPLY",
              text: "📭 That was the only selected topic. Select more on the Topics page.",
            }),
          );
        }

        return { action, nextTopicId, topicId: topic.id };
      }

      // Draft. The morning buffer job may have drafted this topic since the offer went out, or
      // an earlier Draft tap may have failed after creating the post. Either way, finish that
      // post instead of creating a second one.
      const existingPostId = topic.posts[0]?.id;

      await step.run("Mark card as drafting", async () =>
        editTelegramMessage({
          messageId,
          text: `✍️ ${bold("Drafting…")}\n\n${bold(topic.title)}\n\nThis takes a minute or two.`,
        }),
      );

      const postId =
        existingPostId ||
        (await step.run("Create draft", async () => createDraftPostRecordFromTopic(topic.id)));
      const draft = await step.run("Check draft state", async () => findCardPost(postId));

      if (draft?.status === "DRAFTING") {
        await step.run("Prepare cover, dev.to draft and promo copy", async () =>
          preparePostAssetsForReview(postId),
        );
      }

      await step.run("Send approval card", async () => {
        const post = await findCardPost(postId);

        if (!post || post.sourcePlatform || !approvableStatuses.includes(post.status)) {
          throw new Error(
            post ? `The draft is ${post.status}, not ready for approval.` : "Draft disappeared before it could be sent.",
          );
        }

        await editTelegramMessage({
          messageId,
          text: `✍️ Drafted: ${escapeHtml(post.title)}`,
        });
        await sendApprovalCard(post, { heading: "Fresh draft for approval" });
      });

      return { action, postId };
    } catch (error) {
      // Draft is safe to retry (it resumes the same post), so the failure keeps the buttons.
      // Approve is not offered again here: re-running it is a decision for the pipeline UI.
      await step.run("Report failure", async () =>
        sendBotMessage({
          keyboard: action === "draft" ? topicOfferKeyboard(targetId) : undefined,
          kind: "BOT_REPLY",
          replyToMessageId: messageId,
          text: `⚠️ ${bold(`${actionLabels[action]} failed`)}\n\n${escapeHtml(errorMessage(error))}`,
        }),
      );

      throw error;
    }
  },
);

export const telegramFeedbackReceived = inngest.createFunction(
  {
    concurrency: {
      limit: 1,
    },
    id: "telegram-feedback-received",
    retries: 0,
    triggers: [{ event: "telegram/feedback.received" }],
  },
  async ({ event, step }) => {
    const { feedback, messageId, replyToMessageId } = event.data as FeedbackReceivedData;
    const prompt = await step.run("Find Improve prompt", async () => {
      const delivery = await findPendingImprovePrompt(replyToMessageId);

      return delivery?.postId ? { id: delivery.id, postId: delivery.postId } : null;
    });

    if (!prompt) {
      await step.run("Reply with help", async () =>
        sendBotMessage({
          kind: "BOT_REPLY",
          replyToMessageId: messageId,
          text: `I only take notes after you tap ✏️ Improve on a post.\n\n${botHelpText}`,
        }),
      );

      return { skipped: "no_prompt" };
    }

    const { postId } = prompt;

    await step.run("Mark prompt answered", async () =>
      db.notificationDelivery.update({
        where: {
          id: prompt.id,
        },
        data: {
          status: "answered",
        },
      }),
    );

    const ackMessageId = await step.run("Acknowledge feedback", async () =>
      sendBotMessage({
        kind: "BOT_REPLY",
        postId,
        replyToMessageId: messageId,
        text: feedback
          ? "✏️ Revising with your notes. This takes a minute or two."
          : "✏️ Doing a general polish. This takes a minute or two.",
      }),
    );

    try {
      await step.run("Rewrite draft", async () => improvePostWithFeedback(postId, feedback));

      // The rewrite is saved at this point. A dev.to or OpenAI hiccup while refreshing the
      // side assets should not hide the revised card, so report it on the card instead.
      const assetWarning = await step.run("Refresh dev.to draft and promo copy", async () => {
        try {
          await syncDraftAssetsAfterEdit(postId);
          return null;
        } catch (error) {
          return errorMessage(error);
        }
      });

      await step.run("Retire previous cards", async () => retireOtherCards(postId));
      await step.run("Send revised card", async () => {
        const post = await findCardPost(postId);

        if (!post) {
          throw new Error("The post no longer exists.");
        }

        await sendApprovalCard(post, {
          footer: assetWarning
            ? `Heads up: dev.to/promo copy refresh failed (${assetWarning}). Use "Prepare for review" in the pipeline before approving.`
            : undefined,
          heading: "Revised draft for approval",
        });
      });

      return { postId };
    } catch (error) {
      await step.run("Report failure", async () =>
        editTelegramMessage({
          messageId: ackMessageId,
          text: `⚠️ ${bold("Improve failed")}\n\n${escapeHtml(errorMessage(error))}\n\nReply to the Improve prompt again to retry.`,
        }),
      );

      throw error;
    }
  },
);

export const telegramCommandReceived = inngest.createFunction(
  {
    id: "telegram-command-received",
    retries: 0,
    triggers: [{ event: "telegram/command.received" }],
  },
  async ({ event, step }) => {
    const { args = "", command, messageId } = event.data as CommandReceivedData;

    if (command === "idea") {
      const [firstLine = "", ...rest] = args.split("\n");
      const title = truncateText(firstLine, 200);
      const description = rest.join("\n").trim() || null;

      if (!title) {
        return step.run("Explain idea usage", async () =>
          sendBotMessage({
            kind: "BOT_REPLY",
            replyToMessageId: messageId,
            text: [
              "Send the topic after the command:",
              "",
              "<code>/idea Why React keys break animations</code>",
              "",
              "Extra lines become the topic description.",
            ].join("\n"),
          }),
        );
      }

      const topic = await step.run("Add topic", async () => {
        const existing = await db.topic.findFirst({
          where: {
            title: {
              equals: title,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            status: true,
            title: true,
          },
        });

        if (existing) {
          return { ...existing, created: false };
        }

        // Selected, not backlog: your own ideas skip triage. With no audienceFit score they also
        // sort ahead of generated topics in the draft buffer (NULLs first in a DESC sort).
        const created = await db.topic.create({
          data: {
            description,
            status: "selected",
            title,
          },
          select: {
            id: true,
            status: true,
            title: true,
          },
        });

        return { ...created, created: true };
      });

      return step.run("Confirm idea", async () =>
        sendBotMessage({
          keyboard: isActiveTopicStatus(topic.status) ? draftNowKeyboard(topic.id) : undefined,
          kind: "BOT_REPLY",
          replyToMessageId: messageId,
          text: topic.created
            ? `💡 Added to selected topics: ${bold(topic.title)}\n\nThe morning draft buffer will pick it up, or draft it now.`
            : `💡 That topic already exists (${escapeHtml(topic.status)}): ${bold(topic.title)}`,
          topicId: topic.id,
        }),
      );
    }

    if (command === "next") {
      return step.run("Send next for review", async () => sendNextForReview());
    }

    return step.run("Send help", async () =>
      sendBotMessage({
        kind: "BOT_REPLY",
        text: botHelpText,
      }),
    );
  },
);

export const botFunctions = [
  telegramButtonTapped,
  telegramFeedbackReceived,
  telegramCommandReceived,
];
