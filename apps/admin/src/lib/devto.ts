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

export function buildDevToArticle(post: Post) {
  return {
    title: post.title,
    published: false,
    body_markdown: devToBody(post),
    tags: devToTags(post.tags),
    canonical_url: postUrl(post),
    description: post.description || post.subtitle || undefined,
  };
}

export async function createDevToDraft(post: Post) {
  const apiKey = process.env.DEVTO_API_KEY;

  if (!apiKey) {
    throw new Error("DEVTO_API_KEY is required to create a dev.to draft.");
  }

  const response = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
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
