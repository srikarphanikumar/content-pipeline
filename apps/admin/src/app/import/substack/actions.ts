"use server";

import { XMLParser } from "fast-xml-parser";
import TurndownService from "turndown";
import { db, slugify } from "@content-pipeline/db";

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  pubDate?: string;
  description?: string;
  "content:encoded"?: string;
  category?: string | string[];
};

export type SubstackPreviewItem = {
  title: string;
  slug: string;
  sourceUrl: string;
  publishedAt: string | null;
  excerpt: string;
  tags: string[];
  bodyMarkdown: string;
  exists: boolean;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

function normalizeItems(items: FeedItem | FeedItem[] | undefined) {
  if (!items) {
    return [];
  }

  return Array.isArray(items) ? items : [items];
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getGuid(item: FeedItem) {
  if (!item.guid) {
    return null;
  }

  return typeof item.guid === "string" ? item.guid : item.guid["#text"] || null;
}

function itemUrl(item: FeedItem) {
  return item.link || getGuid(item) || "";
}

function itemTags(item: FeedItem) {
  if (!item.category) {
    return ["Substack"];
  }

  return (Array.isArray(item.category) ? item.category : [item.category])
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function itemBodyMarkdown(item: FeedItem) {
  const html = item["content:encoded"] || item.description || "";
  const markdown = turndown.turndown(html).trim();
  return markdown || stripHtml(html);
}

function deriveSlug(title: string, sourceUrl: string) {
  const urlSlug = sourceUrl.split("/").filter(Boolean).pop();
  return slugify(urlSlug || title);
}

function itemExcerpt(item: FeedItem, bodyMarkdown: string) {
  const description = stripHtml(item.description || "");

  if (
    description.length > 40 &&
    !description.toLowerCase().includes("continue reading") &&
    !description.includes("substackcdn.com") &&
    !description.includes("substack-post-media")
  ) {
    return description.slice(0, 220);
  }

  return bodyMarkdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\(https?:\/\/[^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_`[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function feedUrlFromInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Substack URL is required.");
  }

  if (trimmed.endsWith("/feed")) {
    return trimmed;
  }

  return `${trimmed.replace(/\/$/, "")}/feed`;
}

export async function previewSubstackFeed(formData: FormData) {
  const rawUrl = formData.get("feedUrl");
  const feedUrl = feedUrlFromInput(typeof rawUrl === "string" ? rawUrl : "");

  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "UnderTheHoodContentPipeline/0.1",
    },
    next: {
      revalidate: 0,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch feed. Substack returned ${response.status}.`);
  }

  const xml = await response.text();
  const feed = parser.parse(xml);
  const items = normalizeItems(feed?.rss?.channel?.item).slice(0, 100);

  const mappedItems = items
    .map((item) => {
      const title = String(item.title || "").trim();
      const sourceUrl = itemUrl(item);
      const bodyMarkdown = itemBodyMarkdown(item);
      const publishedAt = item.pubDate
        ? new Date(item.pubDate).toISOString()
        : null;

      if (!title || !sourceUrl) {
        return null;
      }

      return {
        title,
        slug: deriveSlug(title, sourceUrl),
        sourceUrl,
        publishedAt,
        excerpt: itemExcerpt(item, bodyMarkdown),
        tags: itemTags(item),
        bodyMarkdown,
      };
    })
    .filter((item): item is Omit<SubstackPreviewItem, "exists"> => Boolean(item));

  const existingPosts = await db.post.findMany({
    where: {
      OR: [
        {
          sourceUrl: {
            in: mappedItems.map((item) => item.sourceUrl),
          },
        },
        {
          slug: {
            in: mappedItems.map((item) => item.slug),
          },
        },
      ],
    },
    select: {
      slug: true,
      sourceUrl: true,
    },
  });

  const existingKeys = new Set(
    existingPosts.flatMap((post) => [post.slug, post.sourceUrl].filter(Boolean)),
  );

  return {
    feedUrl,
    items: mappedItems.map((item) => ({
      ...item,
      exists: existingKeys.has(item.slug) || existingKeys.has(item.sourceUrl),
    })),
  };
}

export async function importSubstackFeed(formData: FormData) {
  const preview = await previewSubstackFeed(formData);
  let imported = 0;
  let skipped = 0;

  for (const item of preview.items) {
    if (item.exists) {
      skipped += 1;
      continue;
    }

    await db.post.create({
      data: {
        title: item.title,
        slug: item.slug,
        description: item.excerpt || null,
        bodyMarkdown: item.bodyMarkdown,
        tags: item.tags.length > 0 ? item.tags : ["Substack"],
        status: "PUBLISHED_BLOG",
        canonicalUrl: `https://blog.mspk.me/posts/${item.slug}`,
        sourcePlatform: "SUBSTACK",
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      },
    });

    imported += 1;
  }

  return {
    feedUrl: preview.feedUrl,
    imported,
    skipped,
    total: preview.items.length,
  };
}
