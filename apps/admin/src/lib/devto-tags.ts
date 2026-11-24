import OpenAI from "openai";
import { db } from "@content-pipeline/db";
import type { Post } from "@content-pipeline/db";

// dev.to distributes posts mostly through tags people follow. A tag nobody follows (the old
// "csscascade" from squashing "CSS Cascade") reaches almost no one, so tags are only ever picked
// from dev.to's real popular tags.

// Used when dev.to's tag list can't be fetched. All long-standing, widely followed dev.to tags.
const fallbackPopularTags = [
  "webdev", "javascript", "programming", "beginners", "tutorial", "react", "ai", "productivity",
  "css", "typescript", "html", "frontend", "node", "nextjs", "performance", "a11y", "testing",
  "security", "architecture", "softwareengineering", "opensource", "career", "learning",
  "discuss", "design", "ux", "vue", "angular", "svelte", "machinelearning", "llm", "devops",
  "git", "api", "database", "browser", "webperf", "codenewbie", "computerscience", "showdev",
];

// Broad, high-traffic tags used to fill any slot the model leaves empty.
const broadTags = ["webdev", "javascript", "programming", "frontend"];

export function sanitizeDevToTags(tags: string[]) {
  const normalized = tags.map((tag) => tag.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 4);
}

let cachedTags: { fetchedAt: number; tags: string[] } | null = null;

// dev.to's public tag listing, most popular first. Cached per server instance for a day.
export async function popularDevToTags() {
  if (cachedTags && Date.now() - cachedTags.fetchedAt < 24 * 60 * 60 * 1000) {
    return cachedTags.tags;
  }

  try {
    const response = await fetch("https://dev.to/api/tags?per_page=300&page=1");

    if (!response.ok) {
      throw new Error(`dev.to tags returned ${response.status}`);
    }

    const tags = ((await response.json()) as Array<{ name?: string }>)
      .map((tag) => tag.name?.toLowerCase().trim() || "")
      .filter((name) => /^[a-z0-9]+$/.test(name));

    if (tags.length < 20) {
      throw new Error("dev.to returned too few tags");
    }

    cachedTags = { fetchedAt: Date.now(), tags };

    return tags;
  } catch (error) {
    console.error("Using fallback dev.to tags", error);

    return fallbackPopularTags;
  }
}

function fillWithBroadTags(chosen: string[]) {
  return sanitizeDevToTags([...chosen, ...broadTags]);
}

export async function chooseDevToTags(
  post: Pick<Post, "bodyMarkdown" | "description" | "tags" | "title">,
) {
  const allowed = await popularDevToTags();
  const allowedSet = new Set(allowed);
  // Without a model, keep any of the post's own tags that are real dev.to tags.
  const ownMatches = sanitizeDevToTags(post.tags).filter((tag) => allowedSet.has(tag));

  if (!process.env.OPENAI_API_KEY) {
    return fillWithBroadTags(ownMatches);
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You pick dev.to tags that maximise the right readers for a technical article. Return only valid JSON.",
        },
        {
          role: "user",
          content: [
            'Return JSON: {"tags": ["...", "...", "...", "..."]}',
            "",
            "Rules:",
            "- Exactly 4 tags, chosen ONLY from the allowed list below. Never invent a tag.",
            "- 1-2 broad, high-traffic tags the target reader follows (e.g. webdev, javascript, programming).",
            "- 2-3 specific tags that match the article's actual subject (e.g. css, react, performance, a11y).",
            "- Order by relevance, most relevant first.",
            "",
            `Allowed tags (most popular first): ${allowed.slice(0, 300).join(", ")}`,
            "",
            `Title: ${post.title}`,
            post.description ? `Description: ${post.description}` : "",
            post.tags.length ? `Author's topic tags: ${post.tags.join(", ")}` : "",
            "",
            "Article excerpt:",
            post.bodyMarkdown.slice(0, 2500),
          ].join("\n"),
        },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message.content || "{}") as { tags?: unknown };
    const picked = Array.isArray(parsed.tags)
      ? sanitizeDevToTags(parsed.tags.filter((tag): tag is string => typeof tag === "string")).filter(
          (tag) => allowedSet.has(tag),
        )
      : [];

    return fillWithBroadTags(picked.length > 0 ? picked : ownMatches);
  } catch (error) {
    console.error("Could not choose dev.to tags", error);

    return fillWithBroadTags(ownMatches);
  }
}

// Picks and saves tags once; tags you edited by hand are never overwritten.
export async function ensureDevToTags(post: Post): Promise<Post> {
  if (post.devToTags.length > 0) {
    return post;
  }

  const devToTags = await chooseDevToTags(post);

  return db.post.update({
    where: {
      id: post.id,
    },
    data: {
      devToTags,
    },
  });
}
