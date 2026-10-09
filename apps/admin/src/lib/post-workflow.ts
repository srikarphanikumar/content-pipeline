import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { db } from "@content-pipeline/db";
import type { Platform, PostStatus, PromotionAssetType } from "@content-pipeline/db";
import {
  cleanGeneratedDraft,
  draftVoiceRules,
  ensureDevToDraft,
  ensurePromotionAssets,
} from "@/app/topics/pipeline";
import { publishBlueskyPost } from "@/lib/bluesky";
import { publishDevToArticle, updateDevToDraft } from "@/lib/devto";
import { publishLinkedInPost } from "@/lib/linkedin";
import { sendPostToActiveSubscribers } from "@/lib/newsletter-send";

// Publishing workflow shared by the admin server actions and the Telegram bot (via Inngest).
// Nothing here checks the admin session: callers do. Keep this out of "use server" files,
// where every export becomes a publicly callable action.

export const queueStatuses: PostStatus[] = [
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

export function canonicalPostUrl(slug: string) {
  return `${blogBaseUrl()}/posts/${slug}`;
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
      externalId: null,
      externalUrl: null,
      publishedAt: null,
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

  if (nextStatus === "PUBLISHED_BLOG" && post.sourcePlatform === null) {
    try {
      await sendPostToActiveSubscribers(postId);
    } catch (error) {
      console.error("Published blog post, but newsletter send failed.", error);
    }
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function publishDevToSyndicationForPost(postId: string) {
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
  } catch (error) {
    await markPlatformPublicationFailed(publication.id, error);
    throw error;
  }
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

async function findDeletableQueuedPost(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
    select: {
      sourcePlatform: true,
      status: true,
      title: true,
      topicId: true,
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

  return post;
}

export async function deleteQueuedPost(postId: string) {
  await findDeletableQueuedPost(postId);

  await db.post.delete({
    where: {
      id: postId,
    },
  });
}

// Reject = delete the draft and retire its topic, so neither the draft buffer nor topic
// generation brings the same idea back. A dev.to draft, if one was made, stays unpublished
// on dev.to: their API cannot delete articles.
export async function rejectPost(postId: string) {
  const post = await findDeletableQueuedPost(postId);

  await db.$transaction([
    db.post.delete({
      where: {
        id: postId,
      },
    }),
    ...(post.topicId
      ? [
          db.topic.update({
            where: {
              id: post.topicId,
            },
            data: {
              status: "rejected",
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/topics");

  return {
    title: post.title,
    topicId: post.topicId,
  };
}

export const approvableStatuses: PostStatus[] = ["DRAFT_READY", "READY_TO_PUBLISH"];
const improvableStatuses: PostStatus[] = ["DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"];

type ImprovedDraft = {
  bodyMarkdown: string;
  description: string;
  subtitle: string;
  title: string;
};

function nonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

// Rewrites a queued draft from editor feedback (or a general polish when feedback is null).
// Only the post fields change here; syncDraftAssetsAfterEdit refreshes dev.to and promo copy.
export async function improvePostWithFeedback(postId: string, feedback: string | null) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found.");
  }

  if (post.sourcePlatform || !improvableStatuses.includes(post.status)) {
    throw new Error("Only unpublished pipeline drafts can be improved.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to improve drafts.");
  }

  const instruction = feedback?.trim()
    ? ["Apply this editor feedback:", feedback.trim()]
    : [
        "There is no specific feedback. Do a general editing pass: sharpen the opening hook, cut filler, tighten explanations, and fix anything that reads as generic or AI-written.",
      ];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You revise drafts for Under The Hood, a technical publication by Srikar Phani Kumar. Return only valid JSON. The voice is human, curious, practical, and conversational, not corporate or academic.",
      },
      {
        role: "user",
        content: [
          "Revise this draft article.",
          "",
          ...instruction,
          "",
          "Return JSON with exactly these keys: title, subtitle, description, bodyMarkdown.",
          "- Keep the title unless the feedback asks to change it.",
          "- Keep everything the feedback does not ask to change. Do not shorten the article unless asked.",
          "- description is a 1-2 sentence summary of the revised article.",
          "",
          ...draftVoiceRules.filter((rule) => !rule.includes("example posts")),
          "",
          "Current draft:",
          JSON.stringify({
            title: post.title,
            subtitle: post.subtitle,
            description: post.description,
            bodyMarkdown: post.bodyMarkdown,
          }),
        ].join("\n"),
      },
    ],
  });
  const content = response.choices[0]?.message.content;
  let parsed: Partial<ImprovedDraft>;

  try {
    parsed = JSON.parse(content || "") as Partial<ImprovedDraft>;
  } catch {
    throw new Error("The rewrite came back as invalid JSON. Try again.");
  }

  if (typeof parsed.bodyMarkdown !== "string" || !parsed.bodyMarkdown.trim()) {
    throw new Error("The rewrite came back without a body. Try again.");
  }

  const title = nonEmptyString(parsed.title, post.title);

  // Guard against an approval that landed while the model was writing: never overwrite a
  // post that has started publishing.
  const { count } = await db.post.updateMany({
    where: {
      id: postId,
      status: {
        in: improvableStatuses,
      },
    },
    data: {
      title,
      subtitle: nonEmptyString(parsed.subtitle, post.subtitle || ""),
      description: nonEmptyString(parsed.description, post.description || ""),
      bodyMarkdown: cleanGeneratedDraft(parsed.bodyMarkdown),
    },
  });

  if (count === 0) {
    throw new Error("The post started publishing before the rewrite finished, so it was left unchanged.");
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  return {
    title,
    titleChanged: title !== post.title,
  };
}

// After an edit, the dev.to draft and the LinkedIn/Bluesky copy still describe the old body.
export async function syncDraftAssetsAfterEdit(postId: string) {
  const [post, devTo] = await Promise.all([
    db.post.findUnique({
      where: {
        id: postId,
      },
    }),
    db.platformPublication.findUnique({
      where: {
        postId_platform: {
          platform: "DEVTO",
          postId,
        },
      },
    }),
  ]);

  if (!post) {
    throw new Error("Post not found.");
  }

  if (devTo?.externalId && devTo.status !== "PUBLISHED") {
    const article = await updateDevToDraft(post, devTo.externalId);

    await db.platformPublication.update({
      where: {
        id: devTo.id,
      },
      data: {
        errorMessage: null,
        externalId: String(article.id),
        externalUrl: article.url || devTo.externalUrl,
        status: "GENERATED",
      },
    });
  } else if (!devTo?.externalId) {
    await ensureDevToDraft(postId);
  }

  await ensurePromotionAssets(postId);
  revalidatePath(`/posts/${postId}`);
}

export async function publicationResults(postId: string) {
  return db.platformPublication.findMany({
    where: {
      postId,
      platform: {
        in: ["BLOG", "DEVTO", "LINKEDIN", "BLUESKY"],
      },
    },
    select: {
      errorMessage: true,
      externalUrl: true,
      platform: true,
      status: true,
    },
  });
}
