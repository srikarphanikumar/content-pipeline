"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, parseTags, slugify } from "@content-pipeline/db";
import type { PostStatus } from "@content-pipeline/db";

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
