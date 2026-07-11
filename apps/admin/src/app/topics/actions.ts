"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, slugify } from "@content-pipeline/db";

type GeneratedTopic = {
  title: string;
  description: string;
  noveltyScore: number | null;
  audienceFit: number | null;
  difficulty: number | null;
};

type GeneratedDraft = {
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  bodyMarkdown: string;
};

type TopicGenerationResult = {
  createdCount: number;
  requestedCount: number;
  source: "openai" | "fallback";
};

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  return value ? Number(value) : null;
}

function scoreValue(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.min(Math.max(Math.round(number), 1), 10);
}

function fallbackTopics(publishedTitles: string[], existingTitles: string[]): GeneratedTopic[] {
  const baseIdeas = [
    {
      title: "What happens when AI-generated UI forgets accessibility",
      description:
        "Explore the hidden accessibility failures that show up when AI generates frontend components without semantic intent.",
      noveltyScore: 9,
      audienceFit: 9,
      difficulty: 7,
    },
    {
      title: "Why AI copilots keep producing inaccessible forms",
      description:
        "Break down labels, names, descriptions, validation, keyboard paths, and why visually-correct forms still fail users.",
      noveltyScore: 9,
      audienceFit: 9,
      difficulty: 6,
    },
    {
      title: "The frontend accessibility bugs automated tests still miss",
      description:
        "Map the gap between lint rules, axe checks, real assistive technology behavior, focus order, and browser defaults.",
      noveltyScore: 8,
      audienceFit: 9,
      difficulty: 7,
    },
    {
      title: "How to review AI-generated React components for accessibility",
      description:
        "Build a practical review model for semantic HTML, ARIA, focus management, keyboard flows, and user-visible states.",
      noveltyScore: 9,
      audienceFit: 8,
      difficulty: 6,
    },
    {
      title: "Why accessible frontend architecture starts before the component",
      description:
        "Explain how product state, copy, error design, async flows, and interaction models shape accessibility before JSX exists.",
      noveltyScore: 9,
      audienceFit: 9,
      difficulty: 7,
    },
    {
      title: "How AI-generated buttons break keyboard expectations",
      description:
        "Look at the subtle ways generated UI changes button semantics, focus states, disabled behavior, and keyboard affordances.",
      noveltyScore: 8,
      audienceFit: 9,
      difficulty: 6,
    },
    {
      title: "The hidden accessibility cost of streaming AI interfaces",
      description:
        "Explore live regions, partial content, focus movement, loading state announcements, and how streaming text affects assistive technology.",
      noveltyScore: 9,
      audienceFit: 9,
      difficulty: 8,
    },
    {
      title: "Why generated React components overuse ARIA",
      description:
        "Explain when ARIA helps, when it overrides useful native semantics, and how to review generated JSX before it ships.",
      noveltyScore: 8,
      audienceFit: 9,
      difficulty: 7,
    },
    {
      title: "How design systems can protect teams from inaccessible AI output",
      description:
        "Break down component contracts, allowed composition paths, prop constraints, and review hooks that keep generated UI usable.",
      noveltyScore: 9,
      audienceFit: 8,
      difficulty: 7,
    },
    {
      title: "The browser focus model AI tools keep misunderstanding",
      description:
        "Map how focus actually moves through DOM order, portals, modals, shadow DOM, and generated interaction flows.",
      noveltyScore: 9,
      audienceFit: 9,
      difficulty: 8,
    },
    {
      title: "Why skeleton screens can make AI apps less accessible",
      description:
        "Examine loading placeholders, layout shifts, announcement timing, and the difference between visual progress and understandable progress.",
      noveltyScore: 8,
      audienceFit: 8,
      difficulty: 6,
    },
    {
      title: "How to test AI-generated forms beyond axe checks",
      description:
        "Build a review path for labels, descriptions, validation timing, keyboard flow, autofill, and screen reader output.",
      noveltyScore: 8,
      audienceFit: 9,
      difficulty: 7,
    },
    {
      title: "The accessibility problem with AI-generated error messages",
      description:
        "Look at error timing, field association, summary patterns, live announcements, and why helpful copy is part of frontend architecture.",
      noveltyScore: 9,
      audienceFit: 8,
      difficulty: 6,
    },
    {
      title: "What happens when generated UI ignores reduced motion",
      description:
        "Explain media queries, animation defaults, transition-heavy AI components, and how motion preferences should shape generated interfaces.",
      noveltyScore: 8,
      audienceFit: 8,
      difficulty: 6,
    },
    {
      title: "Why AI-generated dashboards fail screen reader users",
      description:
        "Explore headings, table semantics, chart alternatives, region labels, update announcements, and navigation density in generated dashboards.",
      noveltyScore: 9,
      audienceFit: 8,
      difficulty: 8,
    },
  ];
  const seen = new Set([...publishedTitles, ...existingTitles].map((title) => title.toLowerCase()));

  return baseIdeas.filter((idea) => !seen.has(idea.title.toLowerCase()));
}

function parseGeneratedTopics(value: string) {
  const parsed = JSON.parse(value) as {
    topics?: Array<{
      title?: unknown;
      description?: unknown;
      noveltyScore?: unknown;
      audienceFit?: unknown;
      difficulty?: unknown;
    }>;
  };

  return (parsed.topics || [])
    .map((topic) => ({
      title: typeof topic.title === "string" ? topic.title.trim() : "",
      description: typeof topic.description === "string" ? topic.description.trim() : "",
      noveltyScore: scoreValue(topic.noveltyScore),
      audienceFit: scoreValue(topic.audienceFit),
      difficulty: scoreValue(topic.difficulty),
    }))
    .filter((topic) => topic.title);
}

function draftFallback(topic: {
  title: string;
  description: string | null;
}): GeneratedDraft {
  const description =
    topic.description ||
    "A practical Under The Hood draft exploring the mechanism, tradeoffs, and production debugging implications.";

  return {
    title: topic.title,
    subtitle: description,
    description,
    tags: ["Frontend", "JavaScript", "Software Engineering"],
    bodyMarkdown: [
      description,
      "",
      "At first, this looks like one of those small implementation details you can ignore.",
      "",
      "Then it shows up in production.",
      "",
      "Something gets slower. Or flickers. Or works in Chrome but not Safari. Or behaves perfectly in development and falls apart once real users touch it.",
      "",
      "That is usually the sign that the abstraction is hiding a real mechanism underneath.",
      "",
      "## What is actually happening",
      "",
      "The important thing is not the API surface. The important thing is the sequence of work the browser or runtime has to do.",
      "",
      "Once you understand that sequence, the bug becomes much less mysterious.",
      "",
      "## The debugging model",
      "",
      "Start by asking what changed, where the work moved, and whether the thing you are looking at is happening on the main thread, the network, the browser engine, or your framework.",
      "",
      "That mental model is usually more useful than memorizing one more rule.",
      "",
      "## The practical takeaway",
      "",
      "- Identify the core mechanism.",
      "- Name the tradeoff.",
      "- Apply the debugging model.",
      "- Decide what to optimize and what to leave alone.",
    ].join("\n"),
  };
}

function cleanGeneratedDraft(value: string) {
  return value
    .replace(/—/g, ", ")
    .replace(/–/g, "-")
    .replace(/^# .+\n+/, "")
    .replace(/^#### /gm, "## ")
    .replace(/^### /gm, "## ")
    .replace(/\n#{1,2} Conclusion\b[\s\S]*$/i, "")
    .replace(/\n#{1,2} References\b[\s\S]*$/i, "")
    .replace(/\n#{1,2} Further Reading\b[\s\S]*$/i, "")
    .trim();
}

function parseGeneratedDraft(value: string, topic: { title: string; description: string | null }) {
  const parsed = JSON.parse(value) as Partial<GeneratedDraft>;
  const fallback = draftFallback(topic);
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()))
    : fallback.tags;

  return {
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
    subtitle:
      typeof parsed.subtitle === "string" && parsed.subtitle.trim()
        ? parsed.subtitle.trim()
        : fallback.subtitle,
    description:
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim()
        : fallback.description,
    tags: tags.slice(0, 8),
    bodyMarkdown:
      typeof parsed.bodyMarkdown === "string" && parsed.bodyMarkdown.trim()
        ? cleanGeneratedDraft(parsed.bodyMarkdown)
        : fallback.bodyMarkdown,
  };
}

async function uniquePostSlug(title: string) {
  const baseSlug = slugify(title);
  let candidate = baseSlug;
  let suffix = 2;

  while (await db.post.findUnique({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createTopic(formData: FormData) {
  const title = stringValue(formData, "title");

  if (!title) {
    throw new Error("Topic title is required.");
  }

  await db.topic.create({
    data: {
      title,
      description: stringValue(formData, "description") || null,
      noveltyScore: numberValue(formData, "noveltyScore"),
      audienceFit: numberValue(formData, "audienceFit"),
      difficulty: numberValue(formData, "difficulty"),
      status: stringValue(formData, "status") || "backlog",
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
}

export async function generateNextBacklogTopics() {
  const result = await generateBacklogTopics();

  revalidatePath("/");
  revalidatePath("/topics");

  return result;
}

export async function generateNextBacklogTopicsFromForm() {
  const params = new URLSearchParams();

  try {
    const result = await generateNextBacklogTopics();
    params.set("generated", String(result.createdCount));
    params.set("source", result.source);
  } catch (error) {
    console.error("Topic generation failed.", error);
    params.set("generated", "error");
  }

  redirect(`/topics?${params.toString()}`);
}

export async function generateBacklogTopics(): Promise<TopicGenerationResult> {
  const [publishedPosts, queuePosts, existingTopics] = await Promise.all([
    db.post.findMany({
      where: {
        OR: [
          {
            sourcePlatform: "SUBSTACK",
          },
          {
            publishedAt: {
              not: null,
            },
          },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: 80,
      select: {
        title: true,
        subtitle: true,
        description: true,
        tags: true,
      },
    }),
    db.post.findMany({
      where: {
        status: {
          in: ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"],
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 40,
      select: {
        title: true,
        status: true,
        tags: true,
      },
    }),
    db.topic.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
      select: {
        title: true,
        description: true,
        status: true,
      },
    }),
  ]);
  const publishedTitles = publishedPosts.map((post) => post.title);
  const existingTitles = [
    ...queuePosts.map((post) => post.title),
    ...existingTopics.map((topic) => topic.title),
  ];
  const apiKey = process.env.OPENAI_API_KEY;
  let ideas: GeneratedTopic[] = fallbackTopics(publishedTitles, existingTitles);
  let source: TopicGenerationResult["source"] = "fallback";

  if (apiKey) {
    const openai = new OpenAI({ apiKey });
    try {
      const response = await openai.chat.completions.create(
        {
          model: "gpt-4.1-mini",
          temperature: 0.65,
          max_tokens: 2200,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are the editorial strategist for Under The Hood, a technical publication for frontend, JavaScript, full-stack, browser internals, performance, and AI engineers. Return only valid JSON.",
            },
            {
              role: "user",
              content: [
                "Generate 12 new article backlog ideas.",
                "",
                "Rules:",
                "- Do not duplicate or lightly rename already published titles.",
                "- Do not duplicate current queue or topic titles.",
                "- Favor AI + accessibility + frontend topics, especially uncommon angles that are not already over-covered.",
                "- Avoid generic accessibility checklists and generic AI takes.",
                "- Prefer concrete browser, React, DOM, ARIA, focus, keyboard, screen reader, design system, AI-generated UI, or frontend architecture mechanisms.",
                "- Each idea should fit the Under The Hood style: explain mechanisms, tradeoffs, debugging, review models, and production implications.",
                "- Return JSON with key topics, an array of objects: title, description, noveltyScore, audienceFit, difficulty.",
                "- Scores are integers from 1 to 10.",
                "",
                "Already published posts:",
                JSON.stringify(publishedPosts),
                "",
                "Current post queue:",
                JSON.stringify(queuePosts),
                "",
                "Existing topic backlog:",
                JSON.stringify(existingTopics),
              ].join("\n"),
            },
          ],
        },
        {
          timeout: 25_000,
        },
      );
      const content = response.choices[0]?.message.content;

      if (content) {
        try {
          const parsedIdeas = parseGeneratedTopics(content);

          if (parsedIdeas.length > 0) {
            ideas = parsedIdeas;
            source = "openai";
          }
        } catch (error) {
          console.error("Could not parse generated topic ideas.", error);
        }
      }
    } catch (error) {
      console.error("OpenAI topic generation failed. Falling back to local ideas.", error);
    }
  }

  const seen = new Set(
    [...publishedTitles, ...existingTitles].map((title) => title.toLowerCase()),
  );
  const uniqueIdeas = ideas
    .filter((idea) => !seen.has(idea.title.toLowerCase()))
    .slice(0, 10);

  if (uniqueIdeas.length === 0) {
    return {
      createdCount: 0,
      requestedCount: 10,
      source,
    };
  }

  await db.topic.createMany({
    data: uniqueIdeas.map((idea) => ({
      title: idea.title,
      description: idea.description || null,
      noveltyScore: idea.noveltyScore,
      audienceFit: idea.audienceFit,
      difficulty: idea.difficulty,
      status: "backlog",
    })),
    skipDuplicates: true,
  });

  return {
    createdCount: uniqueIdeas.length,
    requestedCount: 10,
    source,
  };
}

export async function updateTopicStatus(topicId: string, formData: FormData) {
  const status = stringValue(formData, "status") || "backlog";

  await db.topic.update({
    where: {
      id: topicId,
    },
    data: {
      status,
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
}

export async function updateTopic(topicId: string, formData: FormData) {
  const title = stringValue(formData, "title");

  if (!title) {
    throw new Error("Topic title is required.");
  }

  await db.topic.update({
    where: {
      id: topicId,
    },
    data: {
      title,
      description: stringValue(formData, "description") || null,
      noveltyScore: numberValue(formData, "noveltyScore"),
      audienceFit: numberValue(formData, "audienceFit"),
      difficulty: numberValue(formData, "difficulty"),
      status: stringValue(formData, "status") || "backlog",
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
}

export async function deleteTopic(topicId: string) {
  await db.topic.delete({
    where: {
      id: topicId,
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
  revalidatePath("/posts");
}

export async function selectAllBacklogTopics() {
  await db.topic.updateMany({
    where: {
      status: "backlog",
    },
    data: {
      status: "selected",
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
}

export async function clearAllTopics() {
  await db.topic.deleteMany();

  revalidatePath("/");
  revalidatePath("/topics");
  revalidatePath("/posts");
}

export async function createDraftPostRecordFromTopic(topicId: string) {
  const topic = await db.topic.findUnique({
    where: {
      id: topicId,
    },
    include: {
      posts: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!topic) {
    throw new Error("Topic not found.");
  }

  if (topic.posts[0]) {
    return topic.posts[0].id;
  }

  let draft = draftFallback(topic);

  if (process.env.OPENAI_API_KEY) {
    const publishedPosts = await db.post.findMany({
      where: {
        OR: [
          {
            sourcePlatform: "SUBSTACK",
          },
          {
            publishedAt: {
              not: null,
            },
          },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 40,
      select: {
        title: true,
        description: true,
        bodyMarkdown: true,
        tags: true,
      },
    });
    const styleExamples = publishedPosts.slice(0, 6).map((post) => ({
      title: post.title,
      excerpt: post.bodyMarkdown.slice(0, 1800),
    }));
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write first drafts for Under The Hood, a technical publication by Srikar Phani Kumar. Return only valid JSON. The voice is human, curious, practical, and conversational, not corporate or academic.",
        },
        {
          role: "user",
          content: [
            "Create a strong first-draft article from this topic.",
            "",
            "Return JSON with exactly these keys: title, subtitle, description, tags, bodyMarkdown.",
            "",
            "Voice and style rules:",
            "- Match the style of the example posts below.",
            "- Start from a familiar developer moment, bug, surprise, or tiny annoyance. Do not start with a broad textbook introduction.",
            "- Write like a human engineer explaining something they personally debugged or finally understood.",
            "- Use short paragraphs. Keep the rhythm punchy.",
            "- Use 'you' naturally.",
            "- Explain the mechanism under the hood, but avoid sounding like documentation.",
            "- Prefer concrete examples over abstract claims.",
            "- Do not include a top-level H1 in bodyMarkdown. The app already renders the title.",
            "- Use ## headings for major sections. Do not use tiny #### headings because they are too subtle on dev.to.",
            "- Do not include a References section.",
            "- Do not include a generic Conclusion heading.",
            "- Avoid em dashes entirely.",
            "- Avoid AI-ish phrases like 'delve into', 'unpack', 'paradigm shift', 'robust', 'seamless', 'crucial', 'in today's fast-paced', 'at the heart of', 'game changer'.",
            "- Aim for 1200-1800 words. It should feel like a real Under The Hood deep dive, not a short note.",
            "- Use enough sections, examples, and caveats to make the mechanism useful, but do not pad.",
            "- The goal is a useful human first draft, not a finished encyclopedia entry.",
            "Do not duplicate the titles or angles in the already-published posts.",
            "",
            "Topic:",
            JSON.stringify({
              title: topic.title,
              description: topic.description,
              noveltyScore: topic.noveltyScore,
              audienceFit: topic.audienceFit,
              difficulty: topic.difficulty,
            }),
            "",
            "Already published posts:",
            JSON.stringify(
              publishedPosts.map((post) => ({
                title: post.title,
                description: post.description,
                tags: post.tags,
              })),
            ),
            "",
            "Style examples from published posts:",
            JSON.stringify(styleExamples),
          ].join("\n"),
        },
      ],
    });
    const content = response.choices[0]?.message.content;

    if (content) {
      try {
        draft = parseGeneratedDraft(content, topic);
      } catch (error) {
        console.error("Could not parse generated draft.", error);
      }
    }
  }

  const slug = await uniquePostSlug(draft.title);
  const post = await db.post.create({
    data: {
      title: draft.title,
      slug,
      subtitle: draft.subtitle,
      description: draft.description,
      bodyMarkdown: draft.bodyMarkdown,
      tags: draft.tags,
      status: "DRAFTING",
      canonicalUrl: `${(process.env.BLOG_BASE_URL || "https://blog.mspk.me").replace(/\/$/, "")}/posts/${slug}`,
      topicId,
    },
  });

  await db.topic.update({
    where: {
      id: topicId,
    },
    data: {
      status: "drafting",
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
  revalidatePath("/posts");
  return post.id;
}

export async function createDraftPostFromTopic(topicId: string) {
  const postId = await createDraftPostRecordFromTopic(topicId);
  redirect(`/posts/${postId}`);
}
