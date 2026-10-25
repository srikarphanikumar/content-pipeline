import OpenAI from "openai";
import { put } from "@vercel/blob";
import type { Post } from "@content-pipeline/db";

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
  }>;
};

// What the article explains, boiled down to things a hand-drawn diagram can show.
type CoverStoryboard = {
  headline: string;
  hook: string;
  steps: string[];
  reaction: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

// Rotated per post so the feed doesn't look like one template stamped over and over.
const drawingStyles = [
  "Sketchnote: black fine-liner ink on warm cream paper, loose watercolor washes in muted teal, sage green and burnt orange, hand-lettered headline with slightly uneven baseline.",
  "Whiteboard explainer: thick marker strokes on an off-white board, two or three marker colors (navy, teal, orange), quick confident arrows, a few smudges and corrections left in.",
  "Notebook doodle: blue ballpoint and graphite on dotted notebook paper, highlighter accents in yellow and mint, margin notes and circled words, like an engineer explaining it to a friend.",
  "Risograph zine: two-color print look (teal and coral) on cream stock, slight misregistration, grainy halftone shading, chunky hand-drawn lettering.",
];

function drawingStyleFor(post: Post) {
  const hash = Array.from(post.slug).reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

  return drawingStyles[hash % drawingStyles.length];
}

function fallbackStoryboard(post: Post): CoverStoryboard {
  return {
    headline: post.title,
    hook: "the hidden mechanism behind the title, drawn as a cutaway with a magnifying glass",
    steps: [],
    reaction: "wait, how does that work?",
  };
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function planStoryboard(post: Post): Promise<CoverStoryboard> {
  const openai = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.8,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You plan hand-drawn explainer covers for Under The Hood, a publication that explains how software actually works. Return only valid JSON.",
      },
      {
        role: "user",
        content: [
          "Read the article and plan one cover illustration that teaches its core mechanism at a glance.",
          "",
          "Return JSON with:",
          '- "headline": the cover headline, max 7 words, punchy, can be a question. Usually close to the title.',
          '- "hook": one concrete, slightly playful visual metaphor for the mechanism (e.g. "a bouncer at the door checking each font file\'s ID"). Avoid generic imagery like glowing brains, circuits, servers, or floating code.',
          '- "steps": 3 to 5 labels for the flow the article explains, in order, max 3 words each, plain words a reader would recognise from the article.',
          '- "reaction": a short, casual thought-bubble line from a curious developer, max 6 words.',
          "",
          `Title: ${post.title}`,
          post.subtitle ? `Subtitle: ${post.subtitle}` : "",
          post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : "",
          "",
          "Article:",
          post.bodyMarkdown.slice(0, 6000),
        ].join("\n"),
      },
    ],
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as Record<string, unknown>;
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.map((step) => clean(step, 32)).filter(Boolean).slice(0, 5)
    : [];
  const fallback = fallbackStoryboard(post);

  return {
    headline: clean(parsed.headline, 60) || fallback.headline,
    hook: clean(parsed.hook, 240) || fallback.hook,
    steps,
    reaction: clean(parsed.reaction, 40) || fallback.reaction,
  };
}

function imagePrompt(post: Post, storyboard: CoverStoryboard) {
  return [
    "A hand-drawn explainer illustration used as the cover of a technical article. It should look like a skilled human illustrator drew it by hand for this specific article, not like AI art.",
    "",
    `Drawing style: ${drawingStyleFor(post)}`,
    "",
    "Layout (landscape 3:2):",
    `- Across the top, the hand-lettered headline, spelled exactly: "${storyboard.headline}"`,
    `- Center: the main visual metaphor, drawn big and with personality: ${storyboard.hook}.`,
    storyboard.steps.length > 0
      ? `- A left-to-right flow of small sketched icons joined by dashed hand-drawn arrows, each labelled in small hand lettering, spelled exactly: ${storyboard.steps.map((step) => `"${step}"`).join(" → ")}. These are the only small labels in the image.`
      : null,
    `- Bottom left corner: a friendly cartoon developer, hand on chin, with a speech bubble that says exactly: "${storyboard.reaction}"`,
    "- Small doodles in the margins: question marks, sparkles, a tiny gear, squiggles that echo the topic.",
    "",
    "Make it feel human and interesting:",
    "- visible pen strokes, wobbly lines, imperfect hand lettering, paper texture, a little humor",
    "- flat colors and simple shading, generous white space, one clear focal point",
    "- every piece of text must be spelled exactly as given above; add no other words, no logos, no brand marks",
    "",
    "Avoid the AI-art look: no glossy 3D renders, no neon glow, no dark sci-fi backgrounds, no lens flares, no photorealism, no gradient-heavy digital painting, no floating holographic panels.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function generateImageBytes(prompt: string) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE || "1536x1024",
      output_format: "jpeg",
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image generation failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json()) as OpenAIImageResponse;
  const imageBase64 = result.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI image generation returned no image data.");
  }

  return Buffer.from(imageBase64, "base64");
}

export async function generateAndStoreCoverImage(post: Post) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to store generated cover images.");
  }

  // A bad storyboard response shouldn't block the cover; the title alone still makes a usable image.
  const storyboard = await planStoryboard(post).catch((error) => {
    console.error("Cover storyboard planning failed; using title-only fallback.", error);
    return fallbackStoryboard(post);
  });
  const imageBytes = await generateImageBytes(imagePrompt(post, storyboard));
  const safeSlug = post.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const pathname = `cover-images/${safeSlug}-${Date.now()}.jpg`;
  const blob = await put(pathname, imageBytes, {
    access: "public",
    contentType: "image/jpeg",
  });

  return blob.url;
}
