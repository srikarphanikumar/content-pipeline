"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";
import {
  buildNewsletterEmail,
  sendNewsletterEmail,
} from "@/lib/newsletter-email";

const editableStatuses: SubscriberStatus[] = ["ACTIVE", "UNSUBSCRIBED"];

export async function updateSubscriberStatus(subscriberId: string, formData: FormData) {
  const status = formData.get("status");

  if (typeof status !== "string" || !editableStatuses.includes(status as SubscriberStatus)) {
    throw new Error("Unsupported subscriber status.");
  }

  const nextStatus = status as SubscriberStatus;

  await db.subscriber.update({
    where: {
      id: subscriberId,
    },
    data:
      nextStatus === "ACTIVE"
        ? {
            status: nextStatus,
            confirmedAt: new Date(),
            unsubscribedAt: null,
          }
        : {
            status: nextStatus,
            unsubscribedAt: new Date(),
          },
  });

  revalidatePath("/subscribers");
}

async function latestNewsletterPost() {
  const post = await db.post.findFirst({
    where: {
      status: {
        in: [
          "READY_TO_PUBLISH",
          "PUBLISHED_BLOG",
          "PUBLISHED_DEVTO",
          "PROMOTED_LINKEDIN",
          "PROMOTED_SOCIAL",
          "COMPLETE",
        ],
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

async function latestPublishedNewsletterPost() {
  const post = await db.post.findFirst({
    where: {
      status: {
        in: [
          "PUBLISHED_BLOG",
          "PUBLISHED_DEVTO",
          "PROMOTED_LINKEDIN",
          "PROMOTED_SOCIAL",
          "COMPLETE",
        ],
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

async function recordEmailDelivery(input: Parameters<typeof db.emailDelivery.create>[0]["data"]) {
  await db.emailDelivery.create({
    data: input,
  });
}

export async function sendAdminTestNewsletterEmail() {
  const post = await latestNewsletterPost();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is required for test newsletter sends.");
  }

  const recipient = {
    email: adminEmail,
    unsubscribeToken: null,
  };
  const email = buildNewsletterEmail(post, recipient);

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

  revalidatePath("/subscribers");
  redirect("/subscribers?email=sent-test");
}

export async function sendLatestPostToActiveSubscribers() {
  const post = await latestPublishedNewsletterPost();
  const existingDelivery = await db.emailDelivery.findFirst({
    where: {
      kind: "NEWSLETTER_POST",
      postId: post.id,
      status: "SENT",
    },
  });

  if (existingDelivery) {
    redirect("/subscribers?email=already-sent");
  }

  const subscribers = await db.subscriber.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (subscribers.length === 0) {
    await recordEmailDelivery({
      bodyPreview: post.description || post.subtitle || post.title,
      kind: "NEWSLETTER_POST",
      postId: post.id,
      recipientCount: 0,
      status: "SKIPPED",
      subject: `New Under The Hood post: ${post.title}`,
      errorMessage: "No active subscribers.",
    });
    redirect("/subscribers?email=no-active-subscribers");
  }

  let sentCount = 0;
  const failures: string[] = [];
  let lastProviderMessageId: string | null = null;
  const subject = `New Under The Hood post: ${post.title}`;

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

  await recordEmailDelivery({
    bodyPreview: post.description || post.subtitle || post.title,
    errorMessage: failures.length > 0 ? failures.slice(0, 20).join("\n") : null,
    kind: "NEWSLETTER_POST",
    postId: post.id,
    providerMessageId: lastProviderMessageId,
    recipientCount: sentCount,
    status: failures.length === 0 ? "SENT" : sentCount > 0 ? "PARTIAL" : "FAILED",
    subject,
  });

  revalidatePath("/subscribers");
  redirect(failures.length === 0 ? "/subscribers?email=sent-post" : "/subscribers?email=partial");
}
