import type { Post } from "@content-pipeline/db";
import { ensureDevToTags, sanitizeDevToTags } from "./devto-tags";
import { learningResourceMarkdown } from "./learning-resources";

type DevToArticleResponse = {
  id: number;
  url?: string;
  edited_at?: string | null;
};

function blogBaseUrl() {
  return (process.env.BLOG_BASE_URL || "https://blog.mspk.me").replace(/\/$/, "");
}

function postUrl(post: Pick<Post, "slug">) {
  return `${blogBaseUrl()}/posts/${post.slug}`;
}

function devToBody(post: Post) {
  const canonicalUrl = postUrl(post);
  const learningResources = learningResourceMarkdown(post);
  const cta = [
    "---",
    "",
    learningResources,
    learningResources ? "" : null,
    `Originally published at [Under The Hood](${canonicalUrl}).`,
    "",
    `Get the next deep dive in your inbox: [subscribe to Under The Hood](${blogBaseUrl()}/#subscribe).`,
  ]
    .filter(Boolean)
    .join("\n");

  return `${post.bodyMarkdown.trim()}\n\n${cta}`;
}

function devToApiKey() {
  const apiKey = process.env.DEVTO_API_KEY;

  if (!apiKey) {
    throw new Error("DEVTO_API_KEY is required for dev.to publishing.");
  }

  return apiKey;
}

function devToHeaders() {
  return {
    "Content-Type": "application/json",
    "api-key": devToApiKey(),
  };
}

export function buildDevToArticle(post: Post, options?: { published?: boolean }) {
  return {
    title: post.title,
    published: options?.published ?? false,
    body_markdown: devToBody(post),
    tags: sanitizeDevToTags(post.devToTags.length > 0 ? post.devToTags : post.tags),
    canonical_url: postUrl(post),
    description: post.description || post.subtitle || undefined,
    main_image: post.coverImageUrl || undefined,
  };
}

export async function createDevToDraft(postInput: Post) {
  const post = await ensureDevToTags(postInput);
  const response = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: devToHeaders(),
    body: JSON.stringify({
      article: buildDevToArticle(post),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`dev.to returned ${response.status}: ${errorText}`);
  }

  return (await response.json()) as DevToArticleResponse;
}

// Keeps an unpublished dev.to draft in sync after the post body changes. Recreates the draft
// if it was deleted on dev.to, same as publishDevToArticle does.
export async function updateDevToDraft(postInput: Post, articleId: string) {
  const post = await ensureDevToTags(postInput);
  const response = await fetch(`https://dev.to/api/articles/${articleId}`, {
    method: "PUT",
    headers: devToHeaders(),
    body: JSON.stringify({
      article: buildDevToArticle(post),
    }),
  });

  if (response.status === 404) {
    return createDevToDraft(post);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`dev.to update returned ${response.status}: ${errorText}`);
  }

  return (await response.json()) as DevToArticleResponse;
}

export async function publishDevToArticle(postInput: Post, articleId?: string | null): Promise<DevToArticleResponse> {
  // Drafts made before tag picking existed get proper tags at publish time.
  const post = await ensureDevToTags(postInput);
  const response = await fetch(
    articleId ? `https://dev.to/api/articles/${articleId}` : "https://dev.to/api/articles",
    {
      method: articleId ? "PUT" : "POST",
      headers: devToHeaders(),
      body: JSON.stringify({
        article: buildDevToArticle(post, { published: true }),
      }),
    },
  );

  if (articleId && response.status === 404) {
    return publishDevToArticle(post);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`dev.to publish returned ${response.status}: ${errorText}`);
  }

  return (await response.json()) as DevToArticleResponse;
}
