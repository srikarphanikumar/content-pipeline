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

function excerptFromMarkdown(markdown) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\(https?:\/\/[^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_`[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

const posts = await db.post.findMany({
  where: {
    sourcePlatform: "SUBSTACK",
    OR: [
      {
        description: {
          contains: "substackcdn.com",
        },
      },
      {
        description: {
          contains: "substack-post-media",
        },
      },
    ],
  },
  select: {
    id: true,
    bodyMarkdown: true,
  },
});

for (const post of posts) {
  await db.post.update({
    where: {
      id: post.id,
    },
    data: {
      description: excerptFromMarkdown(post.bodyMarkdown) || null,
    },
  });
}

await db.$disconnect();

console.log(`Repaired ${posts.length} Substack excerpts.`);
