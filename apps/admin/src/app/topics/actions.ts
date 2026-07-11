"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { db } from "@content-pipeline/db";

type GeneratedTopic = {
  title: string;
  description: string;
  noveltyScore: number | null;
  audienceFit: number | null;
  difficulty: number | null;
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
      title: "What actually happens during React hydration",
      description:
        "Explain the browser, DOM, and React runtime handoff that turns server-rendered markup into an interactive app.",
      noveltyScore: 8,
      audienceFit: 9,
      difficulty: 6,
    },
    {
      title: "Why CSS layout bugs are browser engine bugs in disguise",
      description:
        "Walk through layout calculation, containment, overflow, stacking contexts, and how to debug layout from first principles.",
      noveltyScore: 8,
      audienceFit: 8,
      difficulty: 6,
    },
    {
      title: "How JavaScript promises move through the event loop",
      description:
        "A practical deep dive into microtasks, macrotasks, rendering checkpoints, and production async timing bugs.",
      noveltyScore: 7,
      audienceFit: 9,
      difficulty: 5,
    },
    {
      title: "The hidden cost of client-side state synchronization",
      description:
        "Compare URL state, server state, local component state, caches, and queues through real frontend architecture tradeoffs.",
      noveltyScore: 7,
      audienceFit: 8,
      difficulty: 7,
    },
    {
      title: "How AI features change frontend architecture",
      description:
        "Cover streaming responses, optimistic UI, tool calls, background jobs, and where AI work belongs in a product stack.",
      noveltyScore: 9,
      audienceFit: 9,
      difficulty: 7,
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

  if (apiKey) {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.65,
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
            "Generate 10 new article backlog ideas.",
            "",
            "Rules:",
            "- Do not duplicate or lightly rename already published titles.",
            "- Do not duplicate current queue or topic titles.",
            "- Favor concrete, technical, high-signal topics that can become deep engineering essays.",
            "- Each idea should fit the Under The Hood style: explain mechanisms, tradeoffs, debugging, and production implications.",
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
    });
    const content = response.choices[0]?.message.content;

    if (content) {
      try {
        ideas = parseGeneratedTopics(content);
      } catch (error) {
        console.error("Could not parse generated topic ideas.", error);
      }
    }
  }

  const seen = new Set(
    [...publishedTitles, ...existingTitles].map((title) => title.toLowerCase()),
  );
  const uniqueIdeas = ideas
    .filter((idea) => !seen.has(idea.title.toLowerCase()))
    .slice(0, 10);

  if (uniqueIdeas.length === 0) {
    revalidatePath("/");
    revalidatePath("/topics");
    return;
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

  revalidatePath("/");
  revalidatePath("/topics");
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
