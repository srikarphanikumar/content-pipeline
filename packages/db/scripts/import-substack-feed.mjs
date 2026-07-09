import dotenv from "dotenv";
import { XMLParser } from "fast-xml-parser";
import path from "node:path";
import TurndownService from "turndown";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../../..", ".env"), quiet: true });

const feedUrl = process.argv[2];

if (!feedUrl) {
  throw new Error("Usage: npm run import:substack -- https://example.substack.com/feed");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function itemUrl(item) {
  if (item.link) {
    return item.link;
  }

  if (typeof item.guid === "string") {
    return item.guid;
  }

  return item.guid?.["#text"] || "";
}

function itemTags(item) {
  if (!item.category) {
    return ["Substack"];
  }

  return (Array.isArray(item.category) ? item.category : [item.category])
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function itemBodyMarkdown(item) {
  const html = item["content:encoded"] || item.description || "";
  const markdown = turndown.turndown(html).trim();
  return markdown || stripHtml(html);
}

function itemExcerpt(item, bodyMarkdown) {
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

function deriveSlug(title, sourceUrl) {
  const urlSlug = sourceUrl.split("/").filter(Boolean).pop();
  return slugify(urlSlug || title);
}

const response = await fetch(feedUrl, {
  headers: {
    "User-Agent": "UnderTheHoodContentPipeline/0.1",
  },
});

if (!response.ok) {
  throw new Error(`Could not fetch feed. Substack returned ${response.status}.`);
}

const xml = await response.text();
const feed = parser.parse(xml);
const rawItems = feed?.rss?.channel?.item || [];
const items = Array.isArray(rawItems) ? rawItems : [rawItems];

let imported = 0;
let skipped = 0;

for (const item of items) {
  const title = String(item.title || "").trim();
  const sourceUrl = itemUrl(item);
  const bodyMarkdown = itemBodyMarkdown(item);
  const slug = deriveSlug(title, sourceUrl);

  if (!title || !sourceUrl || !bodyMarkdown) {
    skipped += 1;
    continue;
  }

  const existing = await db.post.findFirst({
    where: {
      OR: [{ slug }, { sourceUrl }],
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    skipped += 1;
    continue;
  }

  await db.post.create({
    data: {
      title,
      slug,
      description: itemExcerpt(item, bodyMarkdown) || null,
      bodyMarkdown,
      tags: itemTags(item),
      status: "PUBLISHED_BLOG",
      canonicalUrl: `https://blog.mspk.me/posts/${slug}`,
      sourcePlatform: "SUBSTACK",
      sourceUrl,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    },
  });

  imported += 1;
}

await db.$disconnect();

console.log(`Imported ${imported}. Skipped ${skipped}. Total feed items ${items.length}.`);
