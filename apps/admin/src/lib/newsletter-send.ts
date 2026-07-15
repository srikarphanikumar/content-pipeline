import { db } from "@content-pipeline/db";
import {
  buildNewsletterEmail,
  sendNewsletterEmail,
} from "./newsletter-email";

const publishedStatuses = [
  "PUBLISHED_BLOG",
  "PUBLISHED_DEVTO",
  "PROMOTED_LINKEDIN",
  "PROMOTED_SOCIAL",
  "COMPLETE",
] as const;

async function recordEmailDelivery(input: Parameters<typeof db.emailDelivery.create>[0]["data"]) {
  await db.emailDelivery.create({
    data: input,
  });
}

function positiveIntEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function todayStartNewYork() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/New_York",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 4));
}

async function ownNewsletterSendCountToday() {
  const deliveries = await db.emailDelivery.findMany({
    where: {
      createdAt: {
        gte: todayStartNewYork(),
      },
      status: {
        in: ["SENT", "PARTIAL"],
      },
    },
    select: {
      recipientCount: true,
    },
  });

  return deliveries.reduce((total, delivery) => total + delivery.recipientCount, 0);
}

export async function latestNewsletterPost() {
  const post = await db.post.findFirst({
    where: {
      status: {
        in: ["READY_TO_PUBLISH", ...publishedStatuses],
      },
      sourcePlatform: null,
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
  });

  if (!post) {
    throw new Error("No newsletter-ready post found.");
  }

  return post;
}

export async function latestPublishedNewsletterPost() {
  const post = await db.post.findFirst({
    where: {
      status: {
        in: [...publishedStatuses],
      },
      sourcePlatform: null,
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
  });

  if (!post) {
    throw new Error("No published owned post found for subscriber sending.");
  }

  return post;
}

export async function sendAdminTestNewsletterForPost(postId?: string) {
  const post = postId
    ? await db.post.findUnique({
        where: {
          id: postId,
        },
      })
    : await latestNewsletterPost();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!post) {
    throw new Error("Post not found.");
  }

  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is required for test newsletter sends.");
  }

  const email = buildNewsletterEmail(post, {
    email: adminEmail,
    unsubscribeToken: null,
  });

  try {
    const providerMessageId = await sendNewsletterEmail({
      ...email,
      recipient: adminEmail,
    });

    await recordEmailDelivery({
      bodyPreview: post.description || post.subtitle || post.title,
      kind: "TEST",
      postId: post.id,
      providerMessageId,
      recipient: adminEmail,
      recipientCount: 1,
      status: "SENT",
      subject: email.subject,
    });

    return {
      sent: 1,
      status: "SENT",
    };
  } catch (error) {
    await recordEmailDelivery({
      bodyPreview: post.description || post.subtitle || post.title,
      errorMessage: error instanceof Error ? error.message : "Unknown newsletter test error",
      kind: "TEST",
      postId: post.id,
      recipient: adminEmail,
      recipientCount: 1,
      status: "FAILED",
      subject: email.subject,
    });
    throw error;
  }
}

export async function sendPostToActiveSubscribers(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (!publishedStatuses.includes(post.status as (typeof publishedStatuses)[number])) {
    throw new Error("Only published owned posts can be sent to subscribers.");
  }

  if (post.sourcePlatform) {
    throw new Error("Only owned posts can be sent as newsletter blasts.");
  }

  const existingDelivery = await db.emailDelivery.findFirst({
    where: {
      kind: "NEWSLETTER_POST",
      postId: post.id,
      status: "SENT",
    },
  });

  if (existingDelivery) {
    return {
      skipped: true,
      status: "ALREADY_SENT",
    };
  }

  const alreadySentAfter = post.publishedAt || post.updatedAt || post.createdAt;
  const configuredBatchSize = positiveIntEnv("NEWSLETTER_SEND_BATCH_SIZE", 500);
  const dailySendLimit = positiveIntEnv("NEWSLETTER_DAILY_SEND_LIMIT", 5000);
  const sentToday = await ownNewsletterSendCountToday();
  const availableToday = Math.max(0, dailySendLimit - sentToday);
  const take = Math.min(configuredBatchSize, availableToday);

  if (take === 0) {
    await recordEmailDelivery({
      bodyPreview: post.description || post.subtitle || post.title,
      errorMessage: `Daily newsletter send cap reached for today (${sentToday}/${dailySendLimit}). Continue tomorrow.`,
      kind: "NEWSLETTER_POST",
      postId: post.id,
      recipientCount: 0,
      status: "SKIPPED",
      subject: `New Under The Hood post: ${post.title}`,
    });

    return {
      skipped: true,
      status: "DAILY_LIMIT_REACHED",
    };
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        {
          lastEmailSentAt: null,
        },
        {
          lastEmailSentAt: {
            lt: alreadySentAfter,
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    take,
  });
  const remainingAfterBatch = await db.subscriber.count({
    where: {
      status: "ACTIVE",
      OR: [
        {
          lastEmailSentAt: null,
        },
        {
          lastEmailSentAt: {
            lt: alreadySentAfter,
          },
        },
      ],
    },
  });
  const subject = `New Under The Hood post: ${post.title}`;

  if (subscribers.length === 0) {
    await recordEmailDelivery({
      bodyPreview: post.description || post.subtitle || post.title,
      errorMessage: "No active subscribers.",
      kind: "NEWSLETTER_POST",
      postId: post.id,
      recipientCount: 0,
      status: "SKIPPED",
      subject,
    });

    return {
      skipped: true,
      status: remainingAfterBatch === 0 ? "ALL_RECIPIENTS_ALREADY_SENT" : "NO_ACTIVE_SUBSCRIBERS",
    };
  }

  let sentCount = 0;
  const failures: string[] = [];
  let lastProviderMessageId: string | null = null;

  for (const subscriber of subscribers) {
    const email = buildNewsletterEmail(post, subscriber);

    try {
      lastProviderMessageId = await sendNewsletterEmail({
        ...email,
        recipient: subscriber.email,
      });
      sentCount += 1;
      await db.subscriber.update({
        where: {
          id: subscriber.id,
        },
        data: {
          lastEmailSentAt: new Date(),
        },
      });
    } catch (error) {
      failures.push(
        `${subscriber.email}: ${error instanceof Error ? error.message : "Unknown send error"}`,
      );
    }
  }

  const remainingUnsent = Math.max(0, remainingAfterBatch - sentCount);
  const status =
    failures.length === 0 && remainingUnsent === 0
      ? "SENT"
      : sentCount > 0
        ? "PARTIAL"
        : "FAILED";
  const statusNote =
    remainingUnsent > 0
      ? `${remainingUnsent} active subscribers still need this post. Continue after the daily limit resets.`
      : null;

  await recordEmailDelivery({
    bodyPreview: post.description || post.subtitle || post.title,
    errorMessage:
      failures.length > 0
        ? [statusNote, ...failures.slice(0, 20)].filter(Boolean).join("\n")
        : statusNote,
    kind: "NEWSLETTER_POST",
    postId: post.id,
    providerMessageId: lastProviderMessageId,
    recipientCount: sentCount,
    status,
    subject,
  });

  return {
    failed: failures.length,
    remaining: remainingUnsent,
    sent: sentCount,
    status,
  };
}
