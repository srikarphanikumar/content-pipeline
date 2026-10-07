import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, slugify } from "@content-pipeline/db";
import { generateAndStoreCoverImage } from "@/lib/cover-image";
import { createDevToDraft } from "@/lib/devto";
import { generatePromotionCopy } from "@/lib/promotion";

type GeneratedTopic = {
  title: string;
  description: string;
  focusArea?: string | null;
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
  source: "fallback" | "openai";
};

type TopicGenerationOptions = {
  count?: number;
  focusAreaIds?: string[];
  seed?: string;
};

type FocusAreaContext = {
  id: string;
  name: string;
  angle: string | null;
  weight: number;
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
  const baseIdeas: GeneratedTopic[] = [
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
  const subjects = [
    "browser focus management",
    "CSS containment",
    "React server component boundaries",
    "client-side routing",
    "form validation timing",
    "browser autofill",
    "virtualized lists",
    "design system composition",
    "modal and popover behavior",
    "screen reader announcements",
    "web component boundaries",
    "hydration mismatches",
    "rendering performance budgets",
    "scroll restoration",
    "input latency",
    "semantic HTML contracts",
    "responsive data tables",
    "animation preferences",
    "AI-generated UI review",
    "LLM streaming interfaces",
  ];
  const mechanisms = [
    "breaks in production",
    "confuses accessibility tooling",
    "changes the browser's rendering work",
    "creates debugging blind spots",
    "interacts with keyboard navigation",
    "affects layout stability",
    "changes what assistive technology sees",
    "fails under real user input",
    "creates hidden state bugs",
    "makes performance symptoms misleading",
    "changes the mental model for component APIs",
    "causes subtle cross-browser differences",
  ];
  const generatedIdeas: GeneratedTopic[] = subjects.flatMap((subject, subjectIndex) =>
    mechanisms.map((mechanism, mechanismIndex) => ({
      title: `Why ${subject} ${mechanism}`,
      description: `A practical Under The Hood look at how ${subject} ${mechanism}, what the browser or runtime is actually doing, and how teams can debug it before it ships.`,
      difficulty: Math.min(10, 5 + ((subjectIndex + mechanismIndex) % 5)),
      audienceFit: 8 + ((subjectIndex + mechanismIndex) % 2),
      noveltyScore: 7 + ((subjectIndex + mechanismIndex) % 3),
    })),
  );
  const seen = new Set([...publishedTitles, ...existingTitles].map((title) => title.toLowerCase()));

  return [...baseIdeas, ...generatedIdeas].filter((idea) => !seen.has(idea.title.toLowerCase()));
}

function parseGeneratedTopics(value: string) {
  const parsed = JSON.parse(value) as {
    topics?: Array<{
      title?: unknown;
      description?: unknown;
      focusArea?: unknown;
      noveltyScore?: unknown;
      audienceFit?: unknown;
      difficulty?: unknown;
    }>;
  };

  return (parsed.topics || [])
    .map((topic) => ({
      title: typeof topic.title === "string" ? topic.title.trim() : "",
      description: typeof topic.description === "string" ? topic.description.trim() : "",
      focusArea: typeof topic.focusArea === "string" ? topic.focusArea.trim() : null,
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
      focusAreaId: stringValue(formData, "focusAreaId") || null,
      status: stringValue(formData, "status") || "backlog",
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");
}

export async function generateNextBacklogTopics(options: TopicGenerationOptions = {}) {
  const result = await generateBacklogTopics(options.count, options);

  revalidatePath("/");
  revalidatePath("/topics");

  return result;
}

function generationResultParams(result: TopicGenerationResult) {
  const params = new URLSearchParams();
  params.set("generated", String(result.createdCount));
  params.set("source", result.source);
  return params;
}

export async function generateNextBacklogTopicsFromForm(formData: FormData) {
  let params = new URLSearchParams({ generated: "error" });

  try {
    const result = await generateNextBacklogTopics({
      count: numberValue(formData, "count") || 10,
      focusAreaIds: formData
        .getAll("focusAreaId")
        .filter((id): id is string => typeof id === "string" && id !== ""),
    });
    params = generationResultParams(result);
  } catch (error) {
    console.error("Topic generation failed.", error);
  }

  redirect(`/topics?${params.toString()}`);
}

export async function brainstormTopicsFromForm(formData: FormData) {
  const seed = stringValue(formData, "seed").slice(0, 300);
  const focusAreaId = stringValue(formData, "focusAreaId");
  let params = new URLSearchParams({ generated: "error" });

  if (!seed) {
    redirect("/topics");
  }

  try {
    const result = await generateNextBacklogTopics({
      count: numberValue(formData, "count") || 5,
      focusAreaIds: focusAreaId ? [focusAreaId] : [],
      seed,
    });
    params = generationResultParams(result);
  } catch (error) {
    console.error("Topic brainstorm failed.", error);
  }

  redirect(`/topics?${params.toString()}`);
}

function allocateIdeas(focusAreas: FocusAreaContext[], total: number) {
  const totalWeight = focusAreas.reduce((sum, area) => sum + Math.max(area.weight, 1), 0);
  const shares = focusAreas.map((area) => {
    const exact = (total * Math.max(area.weight, 1)) / totalWeight;
    return { area, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = total - shares.reduce((sum, share) => sum + share.count, 0);

  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (remaining <= 0) {
      break;
    }

    share.count += 1;
    remaining -= 1;
  }

  return shares
    .filter((share) => share.count > 0)
    .map((share) => ({
      name: share.area.name,
      angle: share.area.angle,
      ideaCount: share.count,
    }));
}

async function resolveFocusAreas(options: TopicGenerationOptions): Promise<FocusAreaContext[]> {
  const select = { id: true, name: true, angle: true, weight: true };

  if (options.focusAreaIds && options.focusAreaIds.length > 0) {
    return db.focusArea.findMany({
      where: {
        id: {
          in: options.focusAreaIds,
        },
      },
      orderBy: [{ name: "asc" }],
      select,
    });
  }

  // A seed without an explicit area stays unassigned rather than being forced into one.
  if (options.seed) {
    return [];
  }

  return db.focusArea.findMany({
    where: {
      active: true,
    },
    orderBy: [{ name: "asc" }],
    select,
  });
}

export async function generateBacklogTopics(
  requestedCount = 20,
  options: TopicGenerationOptions = {},
): Promise<TopicGenerationResult> {
  const normalizedRequestedCount = Math.min(Math.max(Math.round(requestedCount), 1), 20);
  const [publishedPosts, queuePosts, existingTopics, focusAreas] = await Promise.all([
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
      take: 220,
      select: {
        title: true,
        description: true,
        status: true,
      },
    }),
    resolveFocusAreas(options),
  ]);
  const publishedTitles = publishedPosts.map((post) => post.title);
  const existingTitles = [
    ...queuePosts.map((post) => post.title),
    ...existingTopics.map((topic) => topic.title),
  ];
  const apiKey = process.env.OPENAI_API_KEY;
  const seed = options.seed?.trim();
  let ideas: GeneratedTopic[];
  let source: TopicGenerationResult["source"];

  if (apiKey) {
    const openai = new OpenAI({ apiKey });
    // Ask for a few extra so de-duplication doesn't leave the batch short.
    const openAiTargetCount = normalizedRequestedCount + 3;
    const focusAreaPlan = allocateIdeas(focusAreas, openAiTargetCount);
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4.1-mini",
        temperature: 0.65,
        max_tokens: 5200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are the editorial strategist for Under The Hood, a technical publication for software engineers that explains how things actually work. Return only valid JSON.",
          },
          {
            role: "user",
            content: [
              `Generate ${openAiTargetCount} new article backlog ideas.`,
              "",
              "Rules:",
              "- Do not duplicate or lightly rename already published titles.",
              "- Do not duplicate current queue or topic titles.",
              ...(seed
                ? [`- Every idea must be a distinct, specific angle on this seed topic: ${JSON.stringify(seed)}.`]
                : []),
              ...(focusAreaPlan.length > 0
                ? [
                    "- Only generate ideas inside the focus areas listed below. Follow each area's angle and idea count.",
                    "- Set focusArea on every idea to exactly one focus area name from the list.",
                  ]
                : seed
                  ? ["- Set focusArea to null on every idea."]
                  : [
                      "- Create a balanced mix of subjects that fit the publication.",
                      "- Set focusArea to null on every idea.",
                    ]),
              "- Avoid generic checklists and generic hot takes.",
              "- Prefer concrete mechanisms: what the runtime, browser, framework, or system is actually doing.",
              "- Each idea should fit the Under The Hood style: explain mechanisms, tradeoffs, debugging, review models, and production implications.",
              `- Return exactly ${openAiTargetCount} ideas if possible.`,
              "- Return JSON with key topics, an array of objects: title, description, focusArea, noveltyScore, audienceFit, difficulty.",
              "- Scores are integers from 1 to 10.",
              "",
              ...(focusAreaPlan.length > 0
                ? ["Focus areas for this batch:", JSON.stringify(focusAreaPlan), ""]
                : []),
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

    if (!content) {
      throw new Error("OpenAI returned no topic ideas.");
    }

    ideas = parseGeneratedTopics(content);
    source = "openai";
  } else if (seed) {
    ideas = [
      {
        title: seed,
        description: "",
        focusArea: null,
        noveltyScore: null,
        audienceFit: null,
        difficulty: null,
      },
    ];
    source = "fallback";
  } else {
    ideas = fallbackTopics(publishedTitles, existingTitles);
    source = "fallback";
  }

  const focusAreaIdByName = new Map(focusAreas.map((area) => [area.name.toLowerCase(), area.id]));
  const singleFocusAreaId = focusAreas.length === 1 ? focusAreas[0].id : null;
  const focusAreaIdFor = (idea: GeneratedTopic) =>
    (idea.focusArea && focusAreaIdByName.get(idea.focusArea.toLowerCase())) || singleFocusAreaId;
  const seen = new Set(
    [...publishedTitles, ...existingTitles].map((title) => title.toLowerCase()),
  );
  const uniqueIdeas = ideas
    // With areas in play, drop ideas the model filed under an area that wasn't requested.
    .filter((idea) => focusAreas.length === 0 || focusAreaIdFor(idea))
    .filter((idea) => !seen.has(idea.title.toLowerCase()))
    .filter((idea, index, allIdeas) => {
      const normalizedTitle = idea.title.toLowerCase();
      return allIdeas.findIndex((candidate) => candidate.title.toLowerCase() === normalizedTitle) === index;
    })
    .slice(0, normalizedRequestedCount);

  if (uniqueIdeas.length === 0) {
    return {
      createdCount: 0,
      requestedCount: normalizedRequestedCount,
      source,
    };
  }

  await db.topic.createMany({
    data: uniqueIdeas.map((idea) => ({
      title: idea.title,
      description: idea.description || null,
      focusAreaId: focusAreaIdFor(idea),
      noveltyScore: idea.noveltyScore,
      audienceFit: idea.audienceFit,
      difficulty: idea.difficulty,
      status: "backlog",
    })),
    skipDuplicates: true,
  });

  return {
    createdCount: uniqueIdeas.length,
    requestedCount: normalizedRequestedCount,
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
      focusAreaId: stringValue(formData, "focusAreaId") || null,
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

export async function selectAllBacklogTopics(focusAreaId?: string | null) {
  const result = await db.topic.updateMany({
    where: {
      status: "backlog",
      ...(focusAreaId === "none" ? { focusAreaId: null } : focusAreaId ? { focusAreaId } : {}),
    },
    data: {
      status: "selected",
    },
  });

  revalidatePath("/");
  revalidatePath("/topics");

  return result.count;
}

export async function selectAllBacklogTopicsFromForm(formData: FormData) {
  const focusAreaId = stringValue(formData, "area");
  const count = await selectAllBacklogTopics(focusAreaId);
  const params = new URLSearchParams({ moved: String(count) });

  if (focusAreaId) {
    params.set("area", focusAreaId);
  }

  redirect(`/topics?${params.toString()}`);
}

export async function clearAllTopics() {
  const result = await db.topic.deleteMany();

  revalidatePath("/");
  revalidatePath("/topics");
  revalidatePath("/posts");

  return result.count;
}

export async function clearAllTopicsFromForm() {
  const count = await clearAllTopics();
  redirect(`/topics?cleared=${count}`);
}

export async function createDraftPostRecordFromTopic(topicId: string) {
  const topic = await db.topic.findUnique({
    where: {
      id: topicId,
    },
    include: {
      focusArea: {
        select: {
          name: true,
          angle: true,
        },
      },
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
              focusArea: topic.focusArea,
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

async function ensureCoverImage(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found after draft creation.");
  }

  if (post.coverImageUrl) {
    return post.coverImageUrl;
  }

  const coverImageUrl = await generateAndStoreCoverImage(post);

  await db.post.update({
    where: {
      id: postId,
    },
    data: {
      coverImageUrl,
    },
  });

  return coverImageUrl;
}

async function ensureDevToDraft(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found for dev.to draft.");
  }

  const existingPublication = await db.platformPublication.findUnique({
    where: {
      postId_platform: {
        platform: "DEVTO",
        postId,
      },
    },
  });

  if (existingPublication?.externalId) {
    return existingPublication.externalId;
  }

  const publication = await db.platformPublication.upsert({
    where: {
      postId_platform: {
        platform: "DEVTO",
        postId,
      },
    },
    create: {
      platform: "DEVTO",
      postId,
      status: "GENERATED",
    },
    update: {
      errorMessage: null,
      status: "GENERATED",
    },
  });

  try {
    const devToArticle = await createDevToDraft(post);

    await db.platformPublication.update({
      where: {
        id: publication.id,
      },
      data: {
        errorMessage: null,
        externalId: String(devToArticle.id),
        externalUrl: devToArticle.url || null,
        status: "GENERATED",
      },
    });

    return String(devToArticle.id);
  } catch (error) {
    await db.platformPublication.update({
      where: {
        id: publication.id,
      },
      data: {
        errorMessage: error instanceof Error ? error.message : "Unknown dev.to error.",
        status: "FAILED",
      },
    });

    throw error;
  }
}

async function ensurePromotionAssets(postId: string) {
  const post = await db.post.findUnique({
    where: {
      id: postId,
    },
  });

  if (!post) {
    throw new Error("Post not found for promotion copy.");
  }

  const promotionCopy = await generatePromotionCopy(post);

  await Promise.all([
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "LINKEDIN_POST",
        },
      },
      create: {
        content: promotionCopy.linkedInPost,
        postId,
        type: "LINKEDIN_POST",
      },
      update: {
        content: promotionCopy.linkedInPost,
      },
    }),
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "LINKEDIN_FIRST_COMMENT",
        },
      },
      create: {
        content: promotionCopy.linkedInFirstComment,
        postId,
        type: "LINKEDIN_FIRST_COMMENT",
      },
      update: {
        content: promotionCopy.linkedInFirstComment,
      },
    }),
    db.promotionAsset.upsert({
      where: {
        postId_type: {
          postId,
          type: "BLUESKY_POST",
        },
      },
      create: {
        content: promotionCopy.blueskyPost.slice(0, 300),
        postId,
        type: "BLUESKY_POST",
      },
      update: {
        content: promotionCopy.blueskyPost.slice(0, 300),
      },
    }),
  ]);
}

async function firstSelectedTopicWithoutPost() {
  return db.topic.findFirst({
    where: {
      posts: {
        none: {},
      },
      status: "selected",
    },
    orderBy: [
      {
        audienceFit: "desc",
      },
      {
        noveltyScore: "desc",
      },
      {
        updatedAt: "asc",
      },
    ],
    select: {
      id: true,
    },
  });
}

export async function preparePostAssetsForReview(postId: string) {
  await ensureCoverImage(postId);
  await ensureDevToDraft(postId);
  await ensurePromotionAssets(postId);

  await db.post.update({
    where: {
      id: postId,
    },
    data: {
      status: "DRAFT_READY",
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/topics");
}

export async function prepareNextSelectedTopicForReview() {
  const topic = await firstSelectedTopicWithoutPost();

  if (!topic) {
    return null;
  }

  const postId = await createDraftPostRecordFromTopic(topic.id);
  await preparePostAssetsForReview(postId);

  return postId;
}

export async function prepareNextSelectedTopicDraft() {
  const topic = await firstSelectedTopicWithoutPost();

  if (!topic) {
    redirect("/topics?prepared=0");
  }

  try {
    const postId = await prepareNextSelectedTopicForReview();

    if (!postId) {
      redirect("/topics?prepared=0");
    }

    redirect(`/posts/${postId}?prepared=1`);
  } catch (error) {
    console.error("Could not prepare next selected topic.", error);
    redirect("/topics?prepared=error");
  }
}

export async function createDraftsForAllSelectedTopics() {
  const selectedTopics = await db.topic.findMany({
    where: {
      posts: {
        none: {},
      },
      status: "selected",
    },
    orderBy: [
      {
        audienceFit: "desc",
      },
      {
        noveltyScore: "desc",
      },
      {
        updatedAt: "asc",
      },
    ],
    select: {
      id: true,
    },
  });
  let createdCount = 0;

  for (const topic of selectedTopics) {
    await createDraftPostRecordFromTopic(topic.id);
    createdCount += 1;
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/topics");
  redirect(`/topics?drafted=${createdCount}`);
}

// Round-robin across focus areas so consecutive drafts don't all land in one subject.
export function interleaveByFocusArea<T extends { focusAreaId: string | null }>(topics: T[]) {
  const groups = new Map<string, T[]>();

  for (const topic of topics) {
    const key = topic.focusAreaId || "none";
    groups.set(key, [...(groups.get(key) || []), topic]);
  }

  const queues = [...groups.values()];
  const interleaved: T[] = [];

  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();

      if (next) {
        interleaved.push(next);
      }
    }
  }

  return interleaved;
}
