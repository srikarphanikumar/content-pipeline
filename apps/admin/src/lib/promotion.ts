import OpenAI from "openai";
import type { Post } from "@content-pipeline/db";

type PromotionCopy = {
  linkedInPost: string;
  linkedInFirstComment: string;
  blueskyPost: string;
};

function blogBaseUrl() {
  return (process.env.BLOG_BASE_URL || "https://blog.mspk.me").replace(/\/$/, "");
}

function postUrl(post: Pick<Post, "slug">) {
  return `${blogBaseUrl()}/posts/${post.slug}`;
}

function postContext(post: Post) {
  return [
    `Title: ${post.title}`,
    post.subtitle ? `Subtitle: ${post.subtitle}` : null,
    post.description ? `Description: ${post.description}` : null,
    post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : null,
    `Canonical URL: ${postUrl(post)}`,
    "",
    "Article markdown excerpt:",
    post.bodyMarkdown.slice(0, 6000),
  ]
    .filter(Boolean)
    .join("\n");
}

function hashtagFromTag(tag: string) {
  return tag
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function linkedInHashtags(post: Post) {
  const baseTags = [
    ...post.tags.map(hashtagFromTag),
    "Frontend",
    "WebDevelopment",
    "JavaScript",
    "WebDev",
  ].filter(Boolean);
  const uniqueTags = Array.from(new Set(baseTags)).slice(0, 10);

  return uniqueTags.map((tag) => `#${tag}`).join(" ");
}

function fallbackPromotionCopy(post: Post): PromotionCopy {
  const url = postUrl(post);
  const summary = post.description || post.subtitle || "A new Under The Hood deep dive is live.";

  return {
    linkedInPost: [
      `If you work on frontend systems, ${post.title.toLowerCase()} is worth understanding.`,
      "",
      summary,
      "",
      "In this article, I break down:",
      "✅ The underlying browser/runtime behavior",
      "✅ Why the common abstraction hides the real tradeoff",
      "✅ The implementation details that cause production bugs",
      "✅ How to reason about the problem when debugging",
      "",
      "Once you understand the mechanics, the behavior gets much easier to predict.",
      "",
      "📖 Read the full article:",
      url,
      "",
      linkedInHashtags(post),
    ].join("\n"),
    linkedInFirstComment: `Read the full essay and subscribe for future Under The Hood deep dives: ${url}`,
    blueskyPost: `${post.title}\n\n${summary}\n\n${url}`.slice(0, 300),
  };
}

function parsePromotionJson(value: string): PromotionCopy {
  const parsed = JSON.parse(value) as Partial<PromotionCopy>;

  if (!parsed.linkedInPost || !parsed.linkedInFirstComment || !parsed.blueskyPost) {
    throw new Error("Promotion response was missing required fields.");
  }

  return {
    linkedInPost: parsed.linkedInPost,
    linkedInFirstComment: parsed.linkedInFirstComment,
    blueskyPost: parsed.blueskyPost.slice(0, 300),
  };
}

export async function generatePromotionCopy(post: Post): Promise<PromotionCopy> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackPromotionCopy(post);
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write LinkedIn-native and Bluesky-native promotion copy for a technical publication called Under The Hood. The audience is frontend, JavaScript, full-stack, and AI engineers. Use concrete technical hooks, crisp spacing, and practical language. Return only valid JSON.",
      },
      {
        role: "user",
        content: [
          "Generate promotion copy for this article.",
          "",
          "Return JSON with exactly these keys:",
          "- linkedInPost: formatted like a strong technical LinkedIn post, 130-230 words. Use this structure: hook line, blank line, short problem/context paragraph, blank line, 'Inside you'll learn:' or 'In this article, I break down:', 4-6 checklist bullets using ✅, blank line, a concluding sentence, blank line, '📖 Read the full article:', canonical URL, blank line, 6-10 relevant hashtags. Do not use markdown bullets. Do not sound salesy.",
          "- linkedInFirstComment: one short CTA sentence pointing to the canonical URL and newsletter. No hashtags.",
          "- blueskyPost: <= 300 characters including the URL, direct and punchy.",
          "",
          postContext(post),
        ].join("\n"),
      },
    ],
  });

  const content = response.choices[0]?.message.content;

  if (!content) {
    return fallbackPromotionCopy(post);
  }

  try {
    return parsePromotionJson(content);
  } catch (error) {
    console.error("Could not parse promotion copy JSON.", error);
    return fallbackPromotionCopy(post);
  }
}
