"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";
import {
  sendAdminTestNewsletterForPost,
  sendPostToActiveSubscribers,
} from "@/lib/newsletter-send";

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

export async function sendAdminTestNewsletterEmail() {
  await sendAdminTestNewsletterForPost();

  revalidatePath("/subscribers");
  redirect("/subscribers?email=sent-test");
}

export async function sendLatestPostToActiveSubscribers() {
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
    redirect("/subscribers?email=no-published-post");
  }

  const result = await sendPostToActiveSubscribers(post.id);

  if (result.status === "ALREADY_SENT") {
    redirect("/subscribers?email=already-sent");
  }

  if (result.status === "NO_ACTIVE_SUBSCRIBERS") {
    redirect("/subscribers?email=no-active-subscribers");
  }

  if (result.status === "ALL_RECIPIENTS_ALREADY_SENT") {
    redirect("/subscribers?email=all-recipients-sent");
  }

  if (result.status === "DAILY_LIMIT_REACHED") {
    redirect("/subscribers?email=daily-limit");
  }

  revalidatePath("/subscribers");
  redirect(result.status === "SENT" ? "/subscribers?email=sent-post" : "/subscribers?email=partial");
}
