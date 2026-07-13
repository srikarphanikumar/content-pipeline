"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, parseTags, slugify } from "@content-pipeline/db";
import type { Platform, PostStatus, PromotionAssetType } from "@content-pipeline/db";
import { publishBlueskyPost } from "@/lib/bluesky";
import { generateAndStoreCoverImage } from "@/lib/cover-image";
import { createDevToDraft, publishDevToArticle } from "@/lib/devto";
import { publishLinkedInPost } from "@/lib/linkedin";
import { generatePromotionCopy } from "@/lib/promotion";

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
const queueStatuses: PostStatus[] = [
  "IDEA",
  "SELECTED",
  "DRAFTING",
  "DRAFT_READY",
  "READY_TO_PUBLISH",
];
const blogPublishedStatuses: PostStatus[] = [
  "PUBLISHED_BLOG",
  "PUBLISHED_DEVTO",
  "PROMOTED_LINKEDIN",
  "PROMOTED_SOCIAL",
  "COMPLETE",
];

function blogBaseUrl() {
  return (process.env.BLOG_BASE_URL || "https://blog.mspk.me").replace(/\/$/, "");
}

function canonicalPostUrl(slug: string) {
  return `${blogBaseUrl()}/posts/${slug}`;
}

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

async function promotionAssetContent(postId: string, type: PromotionAssetType) {
  const asset = await db.promotionAsset.findUnique({
    where: {
      postId_type: {
        postId,
        type,
      },
    },
  });

  if (!asset?.content.trim()) {
    throw new Error("Generate and save promotion copy before posting.");
  }

  return asset.content;
}

async function startPlatformPublication(postId: string, platform: Platform) {
  return db.platformPublication.upsert({
    where: {
      postId_platform: {
        postId,
        platform,
      },
    },
    create: {
      postId,
      platform,
      status: "GENERATED",
      errorMessage: null,
    },
    update: {
      status: "GENERATED",
      errorMessage: null,
    },
  });
}

async function markPlatformPublicationPublished(
  publicationId: string,
  result: {
    externalId?: string | null;
    externalUrl?: string | null;
  },
) {
  await db.platformPublication.update({
    where: {
      id: publicationId,
    },
    data: {
      status: "PUBLISHED",
      externalId: result.externalId || null,
      externalUrl: result.externalUrl || null,
      publishedAt: new Date(),
      errorMessage: null,
    },
  });
}

async function markPlatformPublicationFailed(publicationId: string, error: unknown) {
  await db.platformPublication.update({
    where: {
      id: publicationId,
    },
    data: {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown platform posting error.",
    },
  });
}

async function recordPlatformFailure(postId: string, platform: Platform, error: unknown) {
  await db.platformPublication.upsert({
    where: {
      postId_platform: {
        postId,
        platform,
      },
    },
    create: {
      postId,
      platform,
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown platform posting error.",
    },
    update: {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown platform posting error.",
    },
  });
}

async function isCanonicalBlogPublished(postId: string, status: PostStatus) {
  if (blogPublishedStatuses.includes(status)) {
    return true;
  }

  const publication = await db.platformPublication.findUnique({
    where: {
      postId_platform: {
        postId,
        platform: "BLOG",
      },
    },
    select: {
      status: true,
    },
  });

  return publication?.status === "PUBLISHED";
}

export async function createPost(formData: FormData) {
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
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
    select: {
      sourcePlatform: true,
      status: true,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (post.sourcePlatform === "SUBSTACK") {
    throw new Error("Imported Substack archive posts are protected and cannot be deleted.");
  }

  if (!queueStatuses.includes(post.status)) {
    throw new Error("Only idea, draft, and queue posts can be deleted from the pipeline.");
  }

  await db.post.delete({
    where: {
      id: postId,
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  redirect("/posts");
}

export async function clearPipelineQueue() {
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

export async function generateCoverImageForPost(postId: string) {
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
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (post.sourcePlatform === "SUBSTACK") {
    throw new Error("Imported Substack archive posts are already canonical and cannot be republished.");
  }

  if (!post.title.trim() || !post.slug.trim() || !post.bodyMarkdown.trim()) {
    throw new Error("Title, slug, and body are required before publishing to the blog.");
  }

  const publishedAt = post.publishedAt || new Date();
  const canonicalUrl = post.canonicalUrl || canonicalPostUrl(post.slug);
  const nextStatus = blogPublishedStatuses.includes(post.status)
    ? post.status
    : "PUBLISHED_BLOG";

  await db.$transaction([
    db.post.update({
      where: {
        id: postId,
      },
      data: {
        status: nextStatus,
        canonicalUrl,
        publishedAt,
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
        status: "PUBLISHED",
        externalId: post.slug,
        externalUrl: canonicalUrl,
        publishedAt,
        errorMessage: null,
      },
      update: {
        status: "PUBLISHED",
        externalId: post.slug,
        externalUrl: canonicalUrl,
        publishedAt,
        errorMessage: null,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function schedulePostForTomorrow(postId: string) {
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

async function publishDevToSyndicationForPost(postId: string) {
  const [post, existingPublication] = await Promise.all([
    db.post.findUnique({
      where: {
        id: postId,
      },
    }),
    db.platformPublication.findUnique({
      where: {
        postId_platform: {
          postId,
          platform: "DEVTO",
        },
      },
    }),
  ]);

  if (!post) {
    throw new Error("Post not found.");
  }

  if (existingPublication?.status === "PUBLISHED") {
    return {
      skipped: true,
    };
  }

  const publication = await startPlatformPublication(postId, "DEVTO");

  try {
    const result = await publishDevToArticle(post, existingPublication?.externalId);

    await markPlatformPublicationPublished(publication.id, {
      externalId: String(result.id),
      externalUrl: result.url || existingPublication?.externalUrl || null,
    });

    await db.post.update({
      where: {
        id: postId,
      },
      data: {
        status: "PUBLISHED_DEVTO",
      },
    });

    return {
      skipped: false,
    };
  } catch (error) {
    await markPlatformPublicationFailed(publication.id, error);
    throw error;
  }
}

export async function generatePromotionAssetsForPost(postId: string) {
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
  const [post, linkedInPost, connection] = await Promise.all([
    db.post.findUnique({
      where: {
        id: postId,
      },
    }),
    promotionAssetContent(postId, "LINKEDIN_POST"),
    db.platformConnection.findUnique({
      where: {
        platform: "LINKEDIN",
      },
    }),
  ]);

  if (!post) {
    throw new Error("Post not found.");
  }

  if (!connection) {
    throw new Error("Connect LinkedIn from Settings before posting.");
  }

  const publication = await startPlatformPublication(postId, "LINKEDIN");

  try {
    const result = await publishLinkedInPost({
      accessToken: connection.accessToken,
      imageUrl: post.coverImageUrl,
      memberId: connection.providerAccountId || "",
      title: post.title,
      text: linkedInPost,
    });

    await markPlatformPublicationPublished(publication.id, result);
    await db.post.update({
      where: {
        id: postId,
      },
      data: {
        status: "PROMOTED_LINKEDIN",
      },
    });
  } catch (error) {
    await markPlatformPublicationFailed(publication.id, error);
    throw error;
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function publishBlueskyPromotionForPost(postId: string) {
  const blueskyPost = await promotionAssetContent(postId, "BLUESKY_POST");
  const publication = await startPlatformPublication(postId, "BLUESKY");

  try {
    const result = await publishBlueskyPost(blueskyPost);

    await markPlatformPublicationPublished(publication.id, result);
    await db.post.update({
      where: {
        id: postId,
      },
      data: {
        status: "PROMOTED_SOCIAL",
      },
    });
  } catch (error) {
    await markPlatformPublicationFailed(publication.id, error);
    throw error;
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function publishSyndicationAndSocialsForPost(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
    include: {
      publications: true,
      promotionAssets: true,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (!(await isCanonicalBlogPublished(postId, post.status))) {
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
        status: "FAILED",
        errorMessage: "Publish the canonical blog post before posting to socials.",
      },
      update: {
        status: "FAILED",
        errorMessage: "Publish the canonical blog post before posting to socials.",
      },
    });
    revalidatePath("/posts");
    revalidatePath(`/posts/${postId}`);
    return;
  }

  const publications = new Map(
    post.publications.map((publication) => [publication.platform, publication.status]),
  );
  const tasks: Array<{ platform: Platform; run: () => Promise<unknown> }> = [];

  if (publications.get("DEVTO") !== "PUBLISHED") {
    tasks.push({
      platform: "DEVTO",
      run: () => publishDevToSyndicationForPost(postId),
    });
  }

  tasks.push({
    platform: "LINKEDIN",
    run: () => publishLinkedInPromotionForPost(postId),
  });

  tasks.push({
    platform: "BLUESKY",
    run: () => publishBlueskyPromotionForPost(postId),
  });

  if (tasks.length === 0) {
    revalidatePath("/posts");
    revalidatePath(`/posts/${postId}`);
    return;
  }

  await Promise.all(
    tasks.map(async (task) => {
      try {
        await task.run();
      } catch (error) {
        await recordPlatformFailure(postId, task.platform, error);
      }
    }),
  );

  const publishedCount = await db.platformPublication.count({
    where: {
      postId,
      platform: {
        in: ["DEVTO", "LINKEDIN", "BLUESKY"],
      },
      status: "PUBLISHED",
    },
  });

  if (publishedCount >= 3) {
    await db.post.update({
      where: {
        id: postId,
      },
      data: {
        status: "COMPLETE",
      },
    });
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  // Do not throw from the aggregate action. Each platform action records its own
  // FAILED status and error message, and throwing here crashes the production page.
}

export async function approveAndPublishPost(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
    select: {
      sourcePlatform: true,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (post.sourcePlatform === "SUBSTACK") {
    await recordPlatformFailure(
      postId,
      "BLOG",
      new Error("Imported Substack archive posts cannot be approved for republishing."),
    );
    revalidatePath("/posts");
    revalidatePath(`/posts/${postId}`);
    return;
  }

  await db.post.update({
    where: {
      id: postId,
    },
    data: {
      status: "READY_TO_PUBLISH",
    },
  });

  try {
    await publishBlogCanonicalPost(postId);
  } catch (error) {
    await recordPlatformFailure(postId, "BLOG", error);
    revalidatePath("/posts");
    revalidatePath(`/posts/${postId}`);
    return;
  }

  await publishSyndicationAndSocialsForPost(postId);

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}
