import type { Post } from "@content-pipeline/db";

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

function devToTags(tags: string[]) {
  const normalized = tags
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 4);
}

function devToBody(post: Post) {
  const canonicalUrl = postUrl(post);
  const cta = [
    "---",
    "",
    `Originally published at [Under The Hood](${canonicalUrl}).`,
    "",
    `Get the next deep dive in your inbox: [subscribe to Under The Hood](${blogBaseUrl()}/#subscribe).`,
  ].join("\n");

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
    tags: devToTags(post.tags),
    canonical_url: postUrl(post),
    description: post.description || post.subtitle || undefined,
    main_image: post.coverImageUrl || undefined,
  };
}

export async function createDevToDraft(post: Post) {
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

export async function publishDevToArticle(post: Post, articleId?: string | null) {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`dev.to publish returned ${response.status}: ${errorText}`);
  }

  return (await response.json()) as DevToArticleResponse;
}
