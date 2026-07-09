import dotenv from "dotenv";
import path from "node:path";
import TurndownService from "turndown";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../../..", ".env"), quiet: true });

const sitemapUrl = process.argv.find((arg) => arg.startsWith("http"));
const replaceExisting = process.argv.includes("--replace");

if (!sitemapUrl) {
  throw new Error(
    "Usage: npm run import:substack-sitemap -- https://example.substack.com/sitemap.xml [--replace]",
  );
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

function decodeJsonString(value) {
  return JSON.parse(`"${value}"`);
}

function extractJsonString(html, key) {
  const token = `\\"${key}\\":\\"`;
  const start = html.indexOf(token);

  if (start === -1) {
    return null;
  }

  let index = start + token.length;
  let raw = "";

  while (index < html.length) {
    const char = html[index];

    if (char === '"') {
      let slashCount = 0;
      let cursor = index - 1;

      while (cursor >= 0 && html[cursor] === "\\") {
        slashCount += 1;
        cursor -= 1;
      }

      if (slashCount === 1) {
        return decodeJsonString(raw.endsWith("\\") ? raw.slice(0, -1) : raw);
      }
    }

    raw += char;
    index += 1;
  }

  return null;
}

function extractSitemapPostUrls(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => url.includes("/p/"));
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeImportedMarkdown(markdown) {
  return markdown
    .replace(/\\"/g, '"')
    .replace(
      /\[\s*!\[[^\]]*]\((https?:\/\/[^)]+)\)\s*]\(https?:\/\/[^)]+\)/g,
      "![]($1)",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeLeadingCoverImage(markdown) {
  return markdown
    .replace(/^!\[[^\]]*]\(https?:\/\/[^)]+\)\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanExcerpt(markdown) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\(https?:\/\/[^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_`[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function postSlugFromUrl(url, title) {
  const urlSlug = url.split("/").filter(Boolean).pop();
  return slugify(urlSlug || title);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "UnderTheHoodContentPipeline/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status}`);
  }

  return response.text();
}

const sitemapXml = await fetchText(sitemapUrl);
const urls = extractSitemapPostUrls(sitemapXml);

if (replaceExisting) {
  const deleted = await db.post.deleteMany({
    where: {
      sourcePlatform: "SUBSTACK",
    },
  });
  console.log(`Deleted ${deleted.count} existing Substack posts.`);
}

let imported = 0;
let skipped = 0;
let failed = 0;

for (const url of urls) {
  try {
    const html = await fetchText(url);
    const title = extractJsonString(html, "title");
    const subtitle = extractJsonString(html, "subtitle");
    const description = extractJsonString(html, "description");
    const bodyHtml = extractJsonString(html, "body_html");
    const coverImageUrl = extractJsonString(html, "cover_image");
    const sourceUrl = extractJsonString(html, "canonical_url") || url;
    const publishedAt = extractJsonString(html, "post_date");

    if (!title || !bodyHtml) {
      failed += 1;
      console.warn(`Skipped ${url}: missing title or body_html`);
      continue;
    }

    const slug = postSlugFromUrl(sourceUrl, title);
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

    const cleanBodyHtml = bodyHtml.replace(/\\"/g, '"');
    const normalizedMarkdown = normalizeImportedMarkdown(
      turndown.turndown(cleanBodyHtml).trim(),
    );
    const bodyMarkdown = coverImageUrl
      ? removeLeadingCoverImage(normalizedMarkdown)
      : normalizedMarkdown;

    await db.post.create({
      data: {
        title,
        slug,
        subtitle: subtitle || null,
        description:
          description && description.length > 40
            ? description.slice(0, 220)
            : cleanExcerpt(bodyMarkdown) || null,
        bodyMarkdown,
        coverImageUrl,
        tags: ["Substack"],
        status: "PUBLISHED_BLOG",
        canonicalUrl: `https://blog.mspk.me/posts/${slug}`,
        sourcePlatform: "SUBSTACK",
        sourceUrl,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      },
    });

    imported += 1;
  } catch (error) {
    failed += 1;
    console.warn(`Failed ${url}: ${error instanceof Error ? error.message : error}`);
  }
}

await db.$disconnect();

console.log(
  `Sitemap import complete. Imported ${imported}. Skipped ${skipped}. Failed ${failed}. Total URLs ${urls.length}.`,
);
