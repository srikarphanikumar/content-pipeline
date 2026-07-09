import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../../..", ".env"), quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

function firstMarkdownImage(markdown) {
  const match = markdown.match(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/);
  return match?.[1] || null;
}

function normalizeImportedMarkdown(markdown) {
  return markdown
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

const posts = await db.post.findMany({
  where: {
    sourcePlatform: "SUBSTACK",
  },
  select: {
    id: true,
    bodyMarkdown: true,
    coverImageUrl: true,
  },
});

let repaired = 0;

for (const post of posts) {
  const normalized = normalizeImportedMarkdown(post.bodyMarkdown);
  const coverImageUrl = post.coverImageUrl || firstMarkdownImage(normalized);
  const bodyMarkdown = coverImageUrl
    ? removeLeadingCoverImage(normalized)
    : normalized;

  if (bodyMarkdown !== post.bodyMarkdown || coverImageUrl !== post.coverImageUrl) {
    await db.post.update({
      where: {
        id: post.id,
      },
      data: {
        bodyMarkdown,
        coverImageUrl,
      },
    });
    repaired += 1;
  }
}

await db.$disconnect();

console.log(`Repaired ${repaired} Substack image imports.`);
