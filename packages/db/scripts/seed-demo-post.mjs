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

await db.post.upsert({
  where: {
    slug: "running-ai-models-in-the-browser",
  },
  update: {},
  create: {
    title: "Running AI Models in the Browser Without Wrecking Core Web Vitals",
    slug: "running-ai-models-in-the-browser",
    subtitle: "A demo Under The Hood post for verifying the content pipeline.",
    description:
      "What happens when client-side inference meets real user performance constraints.",
    bodyMarkdown: `## The browser is not just a smaller server

Running AI models in the browser sounds simple until the work collides with hydration, layout, memory pressure, and input responsiveness.

The surprising part is not that inference is expensive. The surprising part is where the cost shows up.

## What to measure

- Time to interactive
- Main-thread blocking
- Model download size
- Memory pressure
- Input latency during streaming UI updates

## The practical rule

Do not treat browser inference as a feature toggle. Treat it as a performance budget with product implications.

That is the kind of topic Under The Hood is built for.`,
    tags: ["AI in Browser", "Frontend Internals"],
    status: "PUBLISHED_BLOG",
    canonicalUrl: "https://blog.mspk.me/posts/running-ai-models-in-the-browser",
    publishedAt: new Date(),
  },
});

await db.$disconnect();

console.log("Seeded demo post: running-ai-models-in-the-browser");
