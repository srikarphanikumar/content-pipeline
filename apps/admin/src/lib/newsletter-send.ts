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
      status: {
        in: ["SENT", "PARTIAL"],
      },
    },
  });

  if (existingDelivery) {
    return {
      skipped: true,
      status: "ALREADY_SENT",
    };
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: {
      createdAt: "asc",
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
      status: "NO_ACTIVE_SUBSCRIBERS",
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

  const status = failures.length === 0 ? "SENT" : sentCount > 0 ? "PARTIAL" : "FAILED";

  await recordEmailDelivery({
    bodyPreview: post.description || post.subtitle || post.title,
    errorMessage: failures.length > 0 ? failures.slice(0, 20).join("\n") : null,
    kind: "NEWSLETTER_POST",
    postId: post.id,
    providerMessageId: lastProviderMessageId,
    recipientCount: sentCount,
    status,
    subject,
  });

  return {
    failed: failures.length,
    sent: sentCount,
    status,
  };
}
