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

function fallbackPromotionCopy(post: Post): PromotionCopy {
  const url = postUrl(post);
  const summary = post.description || post.subtitle || "A new Under The Hood deep dive is live.";

  return {
    linkedInPost: [
      `${post.title}`,
      "",
      summary,
      "",
      "I wrote this for engineers who like understanding the mechanics beneath the abstraction.",
      "",
      url,
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
          "You write concise, high-signal promotion copy for a technical publication called Under The Hood. Avoid hype, emojis, hashtags, and generic thought-leadership phrasing. Return only valid JSON.",
      },
      {
        role: "user",
        content: [
          "Generate promotion copy for this article.",
          "",
          "Return JSON with exactly these keys:",
          "- linkedInPost: 120-180 words, written as a thoughtful technical LinkedIn post, no hashtags.",
          "- linkedInFirstComment: one short CTA sentence pointing to the canonical URL and newsletter.",
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
