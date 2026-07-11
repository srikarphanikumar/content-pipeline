import { put } from "@vercel/blob";
import type { Post } from "@content-pipeline/db";

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
  }>;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function imagePrompt(post: Post) {
  const context = [
    `Title: ${post.title}`,
    post.subtitle ? `Subtitle: ${post.subtitle}` : null,
    post.description ? `Description: ${post.description}` : null,
    post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : null,
    "",
    "Article excerpt:",
    post.bodyMarkdown.slice(0, 2500),
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "Create a polished editorial cover image for a technical article in a publication called Under The Hood.",
    "The image should feel premium, practical, and engineering-focused: abstract browser/runtime systems, code architecture, debugging, performance, or AI infrastructure depending on the article.",
    "Use a strong visual metaphor rather than screenshots. No readable text, no logos, no UI brand marks, no fake code snippets, no people as the main subject.",
    "Style: high-contrast editorial illustration, crisp geometry, subtle depth, black/charcoal base with controlled orange, teal, white, and electric blue accents. Suitable for LinkedIn, dev.to, Medium, and a blog hero.",
    "Composition: 3:2 landscape, clear focal point, uncluttered, enough negative space to crop well in feeds.",
    "",
    context,
  ].join("\n");
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

  const imageBytes = await generateImageBytes(imagePrompt(post));
  const safeSlug = post.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const pathname = `cover-images/${safeSlug}-${Date.now()}.jpg`;
  const blob = await put(pathname, imageBytes, {
    access: "public",
    contentType: "image/jpeg",
  });

  return blob.url;
}
