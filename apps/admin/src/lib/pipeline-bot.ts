import { db } from "@content-pipeline/db";
import type { NotificationKind } from "@content-pipeline/db";
import { approvableStatuses } from "@/lib/post-workflow";
import {
  escapeHtml,
  sendTelegramMessage,
  telegramChatId,
  truncateText,
  type InlineKeyboard,
} from "@/lib/telegram";

export type BotAction = "approve" | "improve" | "reject" | "draft" | "skip" | "retry";

// Telegram caps callback_data at 64 bytes; a one-letter code plus a cuid fits comfortably.
const actionCodes: Record<BotAction, string> = {
  approve: "a",
  draft: "d",
  improve: "i",
  reject: "r",
  retry: "f",
  skip: "s",
};

export function encodeCallback(action: BotAction, targetId: string) {
  return `${actionCodes[action]}:${targetId}`;
}

export function decodeCallback(data: string | undefined) {
  const match = data?.match(/^([a-z]):([A-Za-z0-9_-]{1,60})$/);
  const action = match
    ? (Object.keys(actionCodes) as BotAction[]).find((key) => actionCodes[key] === match[1])
    : undefined;

  return action && match ? { action, targetId: match[2] } : null;
}

export function pipelineBaseUrl() {
  return (process.env.PIPELINE_BASE_URL || "https://pipeline.mspk.me").replace(/\/$/, "");
}

export function adminPostUrl(postId: string) {
  return `${pipelineBaseUrl()}/posts/${postId}`;
}

export const botHelpText = [
  "<b>Under The Hood pipeline</b>",
  "",
  "Each weekday morning I send the next post waiting for approval, and each night the platform stats.",
  "",
  "• <b>Approve</b> publishes to the blog, dev.to, LinkedIn and Bluesky.",
  "• <b>Improve</b> asks what to change. Reply with your notes, or /polish for a general pass.",
  "• <b>Reject</b> drops the draft and its topic, then shows the next one.",
  "",
  "/next shows the next post waiting for approval.",
  "/idea &lt;topic&gt; adds a topic to draft. Extra lines become its description.",
].join("\n");

export async function recordTelegramDelivery(input: {
  bodyPreview?: string;
  errorMessage?: string | null;
  kind: NotificationKind;
  messageId?: number | null;
  postId?: string | null;
  status: string;
  topicId?: string | null;
}) {
  try {
    await db.notificationDelivery.create({
      data: {
        bodyPreview: input.bodyPreview?.slice(0, 4000),
        channel: "TELEGRAM",
        errorMessage: input.errorMessage || null,
        kind: input.kind,
        messageId: input.messageId ? String(input.messageId) : null,
        postId: input.postId || null,
        recipient: process.env.TELEGRAM_CHAT_ID || "unknown",
        status: input.status,
        topicId: input.topicId || null,
      },
    });
  } catch (error) {
    console.error("Failed to record Telegram delivery", error);
  }
}

// Every bot message goes through here so the delivery log, and the message→post mapping that
// button taps and Improve replies rely on, stay complete.
export async function sendBotMessage(input: {
  forceReplyPlaceholder?: string;
  keyboard?: InlineKeyboard;
  kind: NotificationKind;
  postId?: string | null;
  replyToMessageId?: number;
  text: string;
  topicId?: string | null;
}) {
  try {
    const message = await sendTelegramMessage(input);

    await recordTelegramDelivery({
      bodyPreview: input.text,
      kind: input.kind,
      messageId: message.message_id,
      postId: input.postId,
      status: "sent",
      topicId: input.topicId,
    });

    return message.message_id;
  } catch (error) {
    await recordTelegramDelivery({
      bodyPreview: input.text,
      errorMessage: error instanceof Error ? error.message : "Unknown Telegram error.",
      kind: input.kind,
      postId: input.postId,
      status: "failed",
      topicId: input.topicId,
    });
    throw error;
  }
}

// Escapes for Telegram HTML, then renders `inline code` from titles and summaries as <code>.
function formatInline(value: string) {
  return escapeHtml(value).replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function plainSummary(markdown: string) {
  const firstParagraphs = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith("#") && !paragraph.startsWith("!["))
    .slice(0, 2)
    .join(" ");

  return firstParagraphs
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type CardPost = {
  bodyMarkdown: string;
  description: string | null;
  id: string;
  subtitle: string | null;
  title: string;
};

export function approvalCardText(post: CardPost, options: { footer?: string; heading?: string } = {}) {
  const summary = truncateText(post.description || plainSummary(post.bodyMarkdown), 500);
  const subtitle =
    post.subtitle && post.subtitle !== post.description ? truncateText(post.subtitle, 200) : null;

  return [
    `📝 <b>${escapeHtml(options.heading || "Up for approval")}</b>`,
    "",
    `<b>${formatInline(truncateText(post.title, 250))}</b>`,
    subtitle ? `<i>${formatInline(subtitle)}</i>` : null,
    "",
    formatInline(summary),
    "",
    `<a href="${adminPostUrl(post.id)}">Open in pipeline</a>`,
    options.footer ? `\n${escapeHtml(options.footer)}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function approvalKeyboard(postId: string): InlineKeyboard {
  return [
    [
      { callback_data: encodeCallback("approve", postId), text: "✅ Approve" },
      { callback_data: encodeCallback("improve", postId), text: "✏️ Improve" },
      { callback_data: encodeCallback("reject", postId), text: "❌ Reject" },
    ],
  ];
}

type OfferTopic = {
  description: string | null;
  focusArea: { name: string } | null;
  id: string;
  title: string;
};

export function topicOfferText(topic: OfferTopic, options: { footer?: string } = {}) {
  return [
    "💡 <b>No draft is ready. Next topic to draft:</b>",
    "",
    `<b>${formatInline(truncateText(topic.title, 250))}</b>`,
    topic.description ? formatInline(truncateText(topic.description, 400)) : null,
    topic.focusArea ? `\nFocus area: ${escapeHtml(topic.focusArea.name)}` : null,
    "",
    "Drafting takes a minute or two.",
    options.footer ? `\n${escapeHtml(options.footer)}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function topicOfferKeyboard(topicId: string): InlineKeyboard {
  return [
    [
      { callback_data: encodeCallback("draft", topicId), text: "✍️ Draft" },
      { callback_data: encodeCallback("skip", topicId), text: "⏭ Skip" },
    ],
  ];
}

export function draftNowKeyboard(topicId: string): InlineKeyboard {
  return [[{ callback_data: encodeCallback("draft", topicId), text: "✍️ Draft now" }]];
}

const cardPostSelect = {
  bodyMarkdown: true,
  description: true,
  id: true,
  subtitle: true,
  title: true,
} as const;

// Oldest ready draft first. createdAt rather than updatedAt, so improving a post does not push
// it to the back of the line.
export async function findApprovalCandidate() {
  return db.post.findFirst({
    where: {
      sourcePlatform: null,
      status: {
        in: approvableStatuses,
      },
    },
    orderBy: [{ createdAt: "asc" }],
    select: cardPostSelect,
  });
}

export async function findCardPost(postId: string) {
  return db.post.findUnique({
    where: {
      id: postId,
    },
    select: {
      ...cardPostSelect,
      sourcePlatform: true,
      status: true,
    },
  });
}

// Same order the draft buffer uses. Skip walks this list one step past the skipped topic, so
// repeated skips cycle through every selected topic without storing any state.
async function findTopicToOffer(afterTopicId?: string) {
  const topics = await db.topic.findMany({
    where: {
      posts: {
        none: {},
      },
      status: "selected",
    },
    orderBy: [{ audienceFit: "desc" }, { noveltyScore: "desc" }, { updatedAt: "asc" }],
    take: 200,
    select: {
      description: true,
      focusArea: {
        select: {
          name: true,
        },
      },
      id: true,
      title: true,
    },
  });

  if (!afterTopicId) {
    return topics[0] || null;
  }

  const index = topics.findIndex((topic) => topic.id === afterTopicId);
  const next = topics[(index + 1) % Math.max(topics.length, 1)];

  return next && next.id !== afterTopicId ? next : null;
}

export async function sendApprovalCard(
  post: CardPost,
  options: { footer?: string; heading?: string } = {},
) {
  return sendBotMessage({
    keyboard: approvalKeyboard(post.id),
    kind: "APPROVAL_REQUEST",
    postId: post.id,
    text: approvalCardText(post, options),
  });
}

export async function sendTopicOffer(afterTopicId?: string, options: { footer?: string } = {}) {
  const topic = await findTopicToOffer(afterTopicId);

  if (!topic) {
    return null;
  }

  await sendBotMessage({
    keyboard: topicOfferKeyboard(topic.id),
    kind: "TOPIC_OFFER",
    text: topicOfferText(topic, options),
    topicId: topic.id,
  });

  return topic.id;
}

// The "what's next" step shared by the morning job, /next and Reject: the oldest ready draft
// if there is one, otherwise a selected topic to draft, otherwise say the queue is empty.
export async function sendNextForReview(options: { footer?: string; kind?: NotificationKind } = {}) {
  const candidate = await findApprovalCandidate();

  if (candidate) {
    await sendApprovalCard(candidate, { footer: options.footer });
    return { postId: candidate.id, sent: "approval" as const };
  }

  const topicId = await sendTopicOffer(undefined, { footer: options.footer });

  if (topicId) {
    return { sent: "topic" as const, topicId };
  }

  await sendBotMessage({
    kind: options.kind || "BOT_REPLY",
    text: [
      "📭 <b>Nothing to review.</b>",
      "",
      "No drafts are ready and no topics are selected. Select topics on the Topics page and the morning jobs will draft them.",
      options.footer ? `\n${escapeHtml(options.footer)}` : null,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  });

  return { sent: "empty" as const };
}

export async function findPendingImprovePrompt(replyToMessageId: number | null) {
  const recipient = telegramChatId();

  if (replyToMessageId) {
    return db.notificationDelivery.findFirst({
      where: {
        channel: "TELEGRAM",
        kind: "IMPROVE_PROMPT",
        messageId: String(replyToMessageId),
        recipient,
      },
    });
  }

  // Plain message without Telegram's reply link: use the newest unanswered prompt from the
  // last hour, so typing into the chat instead of swiping to reply still works.
  return db.notificationDelivery.findFirst({
    where: {
      channel: "TELEGRAM",
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
      kind: "IMPROVE_PROMPT",
      recipient,
      status: "sent",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function approvalCardMessageIds(postId: string) {
  const deliveries = await db.notificationDelivery.findMany({
    where: {
      channel: "TELEGRAM",
      kind: "APPROVAL_REQUEST",
      messageId: {
        not: null,
      },
      postId,
    },
    select: {
      messageId: true,
    },
  });

  return deliveries.map((delivery) => Number(delivery.messageId)).filter(Number.isFinite);
}

const platformLabels: Record<string, string> = {
  BLOG: "Blog",
  BLUESKY: "Bluesky",
  DEVTO: "dev.to",
  LINKEDIN: "LinkedIn",
};

type PublicationResult = {
  errorMessage: string | null;
  externalUrl: string | null;
  platform: string;
  status: string;
};

export function publishResultCard(
  post: { id: string; title: string },
  results: PublicationResult[],
  heading: string,
): { keyboard?: InlineKeyboard; text: string } {
  const failed = ["BLOG", "DEVTO", "LINKEDIN", "BLUESKY"].filter((platform) =>
    results.some((result) => result.platform === platform && result.status === "FAILED"),
  );

  return {
    // One button retries every failed platform; publishing that already worked is left alone.
    keyboard: failed.length
      ? [
          [
            {
              callback_data: encodeCallback("retry", post.id),
              text: `🔁 Retry ${failed.map((platform) => platformLabels[platform]).join(", ")}`,
            },
          ],
        ]
      : undefined,
    text: [
      heading,
      "",
      `<b>${formatInline(post.title)}</b>`,
      "",
      ...publicationResultLines(results),
      "",
      `<a href="${adminPostUrl(post.id)}">Open in pipeline</a>`,
    ].join("\n"),
  };
}

// Credentials that fail without warning when they lapse. Only LinkedIn expires today:
// dev.to keys and Bluesky app passwords do not.
export async function credentialWarnings(options: { withinDays: number }) {
  const linkedIn = await db.platformConnection.findUnique({
    where: {
      platform: "LINKEDIN",
    },
    select: {
      expiresAt: true,
    },
  });

  if (!linkedIn) {
    return ["LinkedIn is not connected. Connect it in Settings or LinkedIn posts will fail."];
  }

  if (!linkedIn.expiresAt) {
    return [];
  }

  const daysLeft = Math.floor((linkedIn.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  if (daysLeft < 0) {
    return ["LinkedIn token has expired. Reconnect it in Settings before approving."];
  }

  if (daysLeft <= options.withinDays) {
    return [
      daysLeft === 0
        ? "LinkedIn token expires today. Reconnect it in Settings."
        : `LinkedIn token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Reconnect it in Settings.`,
    ];
  }

  return [];
}

export function publicationResultLines(publications: PublicationResult[]) {
  return ["BLOG", "DEVTO", "LINKEDIN", "BLUESKY"].map((platform) => {
    const publication = publications.find((item) => item.platform === platform);
    const label = platformLabels[platform];

    if (publication?.status === "PUBLISHED") {
      return publication.externalUrl
        ? `✅ <a href="${escapeHtml(publication.externalUrl)}">${label}</a>`
        : `✅ ${label}`;
    }

    if (publication?.status === "FAILED") {
      return `❌ ${label}: ${escapeHtml(truncateText(publication.errorMessage || "Failed", 300))}`;
    }

    return `⏸ ${label}: not published`;
  });
}
