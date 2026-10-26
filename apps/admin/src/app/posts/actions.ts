"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, parseTags, slugify } from "@content-pipeline/db";
import type { PostStatus } from "@content-pipeline/db";
import { generateAndStoreCoverImage } from "@/lib/cover-image";
import { createDevToDraft } from "@/lib/devto";
import * as workflow from "@/lib/post-workflow";
import { canonicalPostUrl, queueStatuses } from "@/lib/post-workflow";
import { generatePromotionCopy } from "@/lib/promotion";
import { preparePostAssetsForReview } from "@/app/topics/pipeline";

const statuses: PostStatus[] = [
  "IDEA",
  "SELECTED",
  "DRAFTING",
  "DRAFT_READY",
  "READY_TO_PUBLISH",
  "PUBLISHED_BLOG",
  "PUBLISHED_DEVTO",
  "PROMOTED_LINKEDIN",
  "PROMOTED_SOCIAL",
  "COMPLETE",
];
function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function statusValue(formData: FormData) {
  const value = stringValue(formData, "status") as PostStatus;
  return statuses.includes(value) ? value : "DRAFT_READY";
}

function nullableDateValue(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  return value ? new Date(value) : null;
}

function tomorrowMorningNewYork() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/New_York",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const noonUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  })
    .formatToParts(noonUtc)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offsetName?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  const offsetHours = match ? Number(match[1]) : -4;
  const offsetMinutes = match?.[2] ? Number(match[2]) : 0;
  const offsetTotalMinutes = offsetHours * 60 + Math.sign(offsetHours) * offsetMinutes;

  return new Date(Date.UTC(year, month - 1, day + 1, 9, 0, 0) - offsetTotalMinutes * 60 * 1000);
}

export async function createPost(formData: FormData) {
  await requireAdmin();

  const title = stringValue(formData, "title");
  const slug = slugify(stringValue(formData, "slug") || title);
  const status = statusValue(formData);

  if (!title || !slug) {
    throw new Error("Title and slug are required.");
  }

  const post = await db.post.create({
    data: {
      title,
      slug,
      subtitle: stringValue(formData, "subtitle") || null,
      description: stringValue(formData, "description") || null,
      bodyMarkdown: stringValue(formData, "bodyMarkdown"),
      tags: parseTags(formData.get("tags")),
      status,
      canonicalUrl: stringValue(formData, "canonicalUrl") || null,
      publishedAt: nullableDateValue(formData, "publishedAt"),
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  redirect(`/posts/${post.id}`);
}

export async function updatePost(postId: string, formData: FormData) {
  await requireAdmin();

  const title = stringValue(formData, "title");
  const slug = slugify(stringValue(formData, "slug") || title);

  if (!title || !slug) {
    throw new Error("Title and slug are required.");
  }

  await db.post.update({
    where: {
      id: postId,
    },
    data: {
      title,
      slug,
      subtitle: stringValue(formData, "subtitle") || null,
      description: stringValue(formData, "description") || null,
      bodyMarkdown: stringValue(formData, "bodyMarkdown"),
      tags: parseTags(formData.get("tags")),
      status: statusValue(formData),
      canonicalUrl: stringValue(formData, "canonicalUrl") || null,
      publishedAt: nullableDateValue(formData, "publishedAt"),
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function deletePipelinePost(postId: string) {
  await requireAdmin();
  await workflow.deleteQueuedPost(postId);

  revalidatePath("/");
  revalidatePath("/posts");
  redirect("/posts");
}

export async function clearPipelineQueue() {
  await requireAdmin();

  await db.post.deleteMany({
    where: {
      sourcePlatform: null,
      status: {
        in: queueStatuses,
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/topics");
}

// Same asset step the morning Inngest jobs run: cover image, dev.to draft, promotion copy.
export async function preparePostForReview(postId: string) {
  await requireAdmin();
  await preparePostAssetsForReview(postId);
}

export async function generateCoverImageForPost(postId: string) {
  await requireAdmin();

  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  const coverImageUrl = await generateAndStoreCoverImage(post);

  await db.post.update({
    where: {
      id: postId,
    },
    data: {
      coverImageUrl,
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function publishBlogCanonicalPost(postId: string) {
  await requireAdmin();
  await workflow.publishBlogCanonicalPost(postId);
}

export async function schedulePostForTomorrow(postId: string) {
  await requireAdmin();

  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (post.sourcePlatform === "SUBSTACK") {
    throw new Error("Imported Substack archive posts cannot be scheduled for republishing.");
  }

  if (!post.title.trim() || !post.slug.trim() || !post.bodyMarkdown.trim()) {
    throw new Error("Title, slug, and body are required before scheduling.");
  }

  const scheduledAt = tomorrowMorningNewYork();
  const canonicalUrl = post.canonicalUrl || canonicalPostUrl(post.slug);

  await db.$transaction([
    db.post.update({
      where: {
        id: postId,
      },
      data: {
        status: "READY_TO_PUBLISH",
        canonicalUrl,
        publishedAt: scheduledAt,
      },
    }),
    db.platformPublication.upsert({
      where: {
        postId_platform: {
          postId,
          platform: "BLOG",
        },
      },
      create: {
        postId,
        platform: "BLOG",
        status: "SCHEDULED",
        scheduledAt,
        publishedAt: null,
        externalId: post.slug,
        externalUrl: canonicalUrl,
        errorMessage: null,
      },
      update: {
        status: "SCHEDULED",
        scheduledAt,
        publishedAt: null,
        externalId: post.slug,
        externalUrl: canonicalUrl,
        errorMessage: null,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function createDevToDraftForPost(postId: string) {
  await requireAdmin();

  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  const existingPublication = await db.platformPublication.findUnique({
    where: {
      postId_platform: {
        postId,
        platform: "DEVTO",
      },
    },
  });

  if (existingPublication?.externalId) {
    throw new Error("This post already has a dev.to draft or publication.");
  }

  const publication = await db.platformPublication.upsert({
    where: {
      postId_platform: {
        postId,
        platform: "DEVTO",
      },
    },
    create: {
      postId,
      platform: "DEVTO",
      status: "GENERATED",
    },
    update: {
      status: "GENERATED",
      errorMessage: null,
    },
  });

  try {
    const devToArticle = await createDevToDraft(post);

    await db.platformPublication.update({
      where: {
        id: publication.id,
      },
      data: {
        status: "GENERATED",
        externalId: String(devToArticle.id),
        externalUrl: devToArticle.url || null,
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.platformPublication.update({
      where: {
        id: publication.id,
      },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown dev.to error.",
      },
    });

    throw error;
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function recreateDevToDraftForPost(postId: string) {
  await requireAdmin();

  await db.platformPublication.upsert({
    where: {
      postId_platform: {
        postId,
        platform: "DEVTO",
      },
    },
    create: {
      postId,
      platform: "DEVTO",
      status: "NOT_STARTED",
    },
    update: {
      status: "NOT_STARTED",
      externalId: null,
      externalUrl: null,
      errorMessage: null,
      publishedAt: null,
    },
  });

  await createDevToDraftForPost(postId);
}

export async function publishDevToSyndicationForPost(postId: string) {
  await requireAdmin();
  await workflow.publishDevToSyndicationForPost(postId);
}

export async function generatePromotionAssetsForPost(postId: string) {
  await requireAdmin();

  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  const promotionCopy = await generatePromotionCopy(post);

  await Promise.all([
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "LINKEDIN_POST",
        },
      },
      create: {
        postId,
        type: "LINKEDIN_POST",
        content: promotionCopy.linkedInPost,
      },
      update: {
        content: promotionCopy.linkedInPost,
      },
    }),
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "LINKEDIN_FIRST_COMMENT",
        },
      },
      create: {
        postId,
        type: "LINKEDIN_FIRST_COMMENT",
        content: promotionCopy.linkedInFirstComment,
      },
      update: {
        content: promotionCopy.linkedInFirstComment,
      },
    }),
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "BLUESKY_POST",
        },
      },
      create: {
        postId,
        type: "BLUESKY_POST",
        content: promotionCopy.blueskyPost,
      },
      update: {
        content: promotionCopy.blueskyPost,
      },
    }),
  ]);

  revalidatePath(`/posts/${postId}`);
}

export async function updatePromotionAssetsForPost(postId: string, formData: FormData) {
  await requireAdmin();

  const linkedInPost = stringValue(formData, "linkedInPost");
  const linkedInFirstComment = stringValue(formData, "linkedInFirstComment");
  const blueskyPost = stringValue(formData, "blueskyPost");

  await Promise.all([
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "LINKEDIN_POST",
        },
      },
      create: {
        postId,
        type: "LINKEDIN_POST",
        content: linkedInPost,
      },
      update: {
        content: linkedInPost,
      },
    }),
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "LINKEDIN_FIRST_COMMENT",
        },
      },
      create: {
        postId,
        type: "LINKEDIN_FIRST_COMMENT",
        content: linkedInFirstComment,
      },
      update: {
        content: linkedInFirstComment,
      },
    }),
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "BLUESKY_POST",
        },
      },
      create: {
        postId,
        type: "BLUESKY_POST",
        content: blueskyPost.slice(0, 300),
      },
      update: {
        content: blueskyPost.slice(0, 300),
      },
    }),
  ]);

  revalidatePath(`/posts/${postId}`);
}

export async function publishLinkedInPromotionForPost(postId: string) {
  await requireAdmin();
  await workflow.publishLinkedInPromotionForPost(postId);
}

export async function publishBlueskyPromotionForPost(postId: string) {
  await requireAdmin();
  await workflow.publishBlueskyPromotionForPost(postId);
}

export async function publishSyndicationAndSocialsForPost(postId: string) {
  await requireAdmin();
  await workflow.publishSyndicationAndSocialsForPost(postId);
}

export async function approveAndPublishPost(postId: string) {
  await requireAdmin();
  await workflow.approveAndPublishPost(postId);
}
