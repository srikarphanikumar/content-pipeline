import type { Post } from "@content-pipeline/db";
import { learningResourceMarkdown } from "./learning-resources";

type HashnodePost = {
  id: string;
  url?: string | null;
};

type HashnodeResponse<T> = {
  data?: T | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
};

function blogBaseUrl() {
  return (process.env.BLOG_BASE_URL || "https://blog.mspk.me").replace(/\/$/, "");
}

function postUrl(post: Pick<Post, "slug">) {
  return `${blogBaseUrl()}/posts/${post.slug}`;
}

export function hashnodeConfigured() {
  return Boolean(process.env.HASHNODE_TOKEN && process.env.HASHNODE_PUBLICATION_ID);
}

function hashnodeTags(tags: string[]) {
  const seen = new Set<string>();

  return tags
    .map((tag) => ({
      name: tag.trim(),
      slug: tag
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    }))
    .filter((tag) => tag.slug && !seen.has(tag.slug) && seen.add(tag.slug))
    .slice(0, 5);
}

function hashnodeBody(post: Post) {
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

function buildHashnodePostInput(post: Post) {
  const subtitle = post.subtitle || post.description;

  return {
    title: post.title,
    subtitle: subtitle ? subtitle.slice(0, 150) : undefined,
    contentMarkdown: hashnodeBody(post),
    originalArticleURL: postUrl(post),
    tags: hashnodeTags(post.tags),
    coverImageOptions: post.coverImageUrl ? { coverImageURL: post.coverImageUrl } : undefined,
  };
}

async function hashnodeRequest<T>(query: string, variables: Record<string, unknown>) {
  const token = process.env.HASHNODE_TOKEN;

  if (!token) {
    throw new Error("HASHNODE_TOKEN is required for Hashnode publishing.");
  }

  const response = await fetch("https://gql.hashnode.com", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Hashnode returned ${response.status}: ${await response.text()}`);
  }

  // GraphQL reports failures in the body with a 200 status.
  return (await response.json()) as HashnodeResponse<T>;
}

function hashnodeError(result: HashnodeResponse<unknown>) {
  return new Error(
    `Hashnode error: ${result.errors?.map((error) => error.message).join("; ") || "no post returned"}`,
  );
}

async function createHashnodePost(post: Post) {
  const publicationId = process.env.HASHNODE_PUBLICATION_ID;

  if (!publicationId) {
    throw new Error("HASHNODE_PUBLICATION_ID is required for Hashnode publishing.");
  }

  const result = await hashnodeRequest<{ publishPost: { post: HashnodePost | null } }>(
    `mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) { post { id url } }
    }`,
    { input: { ...buildHashnodePostInput(post), publicationId } },
  );
  const created = result.data?.publishPost.post;

  if (!created) {
    throw hashnodeError(result);
  }

  return created;
}

// Publishes straight to the Hashnode blog, with the canonical URL pointing back here.
// Re-running updates the existing post instead of duplicating it, and recreates it if it was
// deleted on Hashnode.
export async function publishHashnodePost(post: Post, postId?: string | null) {
  if (!postId) {
    return createHashnodePost(post);
  }

  const result = await hashnodeRequest<{ updatePost: { post: HashnodePost | null } }>(
    `mutation UpdatePost($input: UpdatePostInput!) {
      updatePost(input: $input) { post { id url } }
    }`,
    { input: { ...buildHashnodePostInput(post), id: postId } },
  );
  const updated = result.data?.updatePost.post;

  if (updated) {
    return updated;
  }

  if (result.errors?.some((error) => error.extensions?.code === "NOT_FOUND")) {
    return createHashnodePost(post);
  }

  throw hashnodeError(result);
}
