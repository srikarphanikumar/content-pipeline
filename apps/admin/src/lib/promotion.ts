import OpenAI from "openai";
import { db } from "@content-pipeline/db";
import type { Post } from "@content-pipeline/db";
import { learningResourcePromptContext } from "./learning-resources";

type PromotionCopy = {
  linkedInPost: string;
  linkedInFirstComment: string;
  blueskyPost: string;
};

// LinkedIn posts rotate through these so the feed doesn't see the same template every day.
// The key is stored on the post (linkedInFormat) so formats can be compared by results.
export const linkedInFormats = {
  story:
    "A short first-person debugging story: the moment it broke, what you assumed, what was really happening, and the lesson. 120-200 words.",
  contrarian:
    "Open with a sharp, defensible contrarian take drawn from the article (\"X isn't the problem. Y is.\"), then 3-4 short paragraphs backing it with the actual mechanism. 100-180 words.",
  explainer:
    "One surprising fact as the hook, then explain the mechanism plainly in 3-5 short paragraphs, ending with the practical takeaway. 120-200 words.",
  question:
    "Open with a question engineers often get wrong in code review or interviews, give a beat for the reader to guess, then the answer and why. 100-180 words.",
  mistakes:
    "\"3 mistakes I keep seeing with <topic>\": numbered 1. 2. 3., each one line plus one line on why it bites. 100-170 words.",
} as const;

export type LinkedInFormat = keyof typeof linkedInFormats;

const formatOrder = Object.keys(linkedInFormats) as LinkedInFormat[];
const maxLinkedInHashtags = 5;
const maxBlueskyHashtags = 3;

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
    "",
    "Article markdown excerpt:",
    post.bodyMarkdown.slice(0, 6000),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

// Next format in rotation after the ones used most recently, so consecutive posts differ.
async function nextLinkedInFormat(postId: string): Promise<LinkedInFormat> {
  const recent = await db.post.findMany({
    where: {
      id: { not: postId },
      linkedInFormat: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: formatOrder.length - 1,
    select: { linkedInFormat: true },
  });
  const recentFormats = new Set(recent.map((post) => post.linkedInFormat));

  return formatOrder.find((format) => !recentFormats.has(format)) || formatOrder[0];
}

function stripUrls(text: string) {
  return text.replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n");
}

// Keeps the first `max` distinct hashtags and drops the rest, so a model that over-tags can't
// turn the post back into a hashtag wall.
function limitHashtags(text: string, max: number) {
  const kept = new Set<string>();

  return text
    .replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (match, prefix: string, tag: string) => {
      const key = tag.toLowerCase();

      if (kept.has(key)) {
        return prefix;
      }

      if (kept.size >= max) {
        return prefix;
      }

      kept.add(key);
      return match;
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanLinkedInPost(text: string) {
  return limitHashtags(stripUrls(text), maxLinkedInHashtags);
}

export function cleanBlueskyPost(text: string) {
  return limitHashtags(stripUrls(text), maxBlueskyHashtags).slice(0, 300).trim();
}

// The link lives here rather than in the post body. Built in code, not by the model, so the
// URL is always exactly right.
function linkedInFirstComment(post: Post) {
  return [
    `Full article: ${postUrl(post)}`,
    "",
    `I write one of these deep dives every weekday. Get them in your inbox: ${blogBaseUrl()}/#subscribe`,
  ].join("\n");
}

function hashtag(tag: string) {
  return `#${tag
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
}

function fallbackPromotionCopy(post: Post): PromotionCopy {
  const summary = post.description || post.subtitle || "A new Under The Hood deep dive is live.";
  const tags = post.tags.slice(0, 3).map(hashtag).join(" ");

  return {
    linkedInPost: cleanLinkedInPost(
      [post.title, "", summary, "", "Full breakdown in the first comment.", "", tags || "#WebDev"].join("\n"),
    ),
    linkedInFirstComment: linkedInFirstComment(post),
    blueskyPost: cleanBlueskyPost(`${post.title}\n\n${summary}\n\n${post.tags.slice(0, 2).map(hashtag).join(" ")}`),
  };
}

export async function generatePromotionCopy(post: Post): Promise<PromotionCopy> {
  const format = await nextLinkedInFormat(post.id);

  await db.post.update({
    where: { id: post.id },
    data: { linkedInFormat: format },
  });

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackPromotionCopy(post);
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write native social posts for Srikar, a senior frontend engineer who publishes Under The Hood, a technical publication. The audience is frontend, JavaScript, full-stack and AI engineers. Write like a real engineer talking to peers: specific, opinionated, plain. Return only valid JSON.",
      },
      {
        role: "user",
        content: [
          "Write social posts for this article.",
          "",
          'Return JSON with exactly these keys: "linkedInPost", "blueskyPost".',
          "",
          "linkedInPost:",
          `- Format: ${linkedInFormats[format]}`,
          "- The first line is the hook and must stand alone. It is all most people see before \"see more\".",
          "- Short paragraphs, 1-3 lines each, blank lines between them.",
          "- NO links or URLs anywhere. End with one line pointing to the first comment, e.g. \"Full breakdown in the first comment.\"",
          "- End with exactly 3 hashtags on their own line: specific to the topic first, one broad (e.g. #WebDev, #JavaScript). No more than 3.",
          "- Do NOT use checklist emojis (✅), \"In this article\", \"Inside you'll learn\", or a bullet list of what the article covers.",
          "- At most one emoji in the whole post. No em dashes.",
          "- Avoid AI-sounding words: delve, unpack, robust, seamless, crucial, game changer, in today's fast-paced, at the heart of.",
          "",
          "blueskyPost:",
          "- At most 260 characters. A link card to the article is attached automatically, so do NOT include a URL.",
          "- One concrete, specific insight from the article, said plainly.",
          "- End with 2 relevant hashtags.",
          "",
          learningResourcePromptContext(post),
          "",
          postContext(post),
        ].join("\n"),
      },
    ],
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message.content || "") as Partial<PromotionCopy>;

    if (!parsed.linkedInPost?.trim() || !parsed.blueskyPost?.trim()) {
      throw new Error("Promotion response was missing required fields.");
    }

    return {
      linkedInPost: cleanLinkedInPost(parsed.linkedInPost),
      linkedInFirstComment: linkedInFirstComment(post),
      blueskyPost: cleanBlueskyPost(parsed.blueskyPost),
    };
  } catch (error) {
    console.error("Could not parse promotion copy JSON.", error);
    return fallbackPromotionCopy(post);
  }
}
