import type { Post } from "@content-pipeline/db";

type LearningResource = {
  hashtags: string[];
  keywords: string[];
  label: string;
  linkedInText: string;
  url: string;
};

const resources: LearningResource[] = [
  {
    hashtags: ["#Accessibility", "#A11y", "#WebAccessibility"],
    keywords: ["a11y", "accessibility", "aria", "screen reader", "keyboard navigation", "focus"],
    label: "W3C WAI accessibility guidance",
    linkedInText: "W3C Web Accessibility Initiative",
    url: "https://www.w3.org/WAI/",
  },
  {
    hashtags: ["#Accessibility", "#A11y", "#WebDev"],
    keywords: ["a11y", "accessibility", "aria", "screen reader", "keyboard navigation", "focus"],
    label: "W3Schools accessibility tutorials",
    linkedInText: "W3Schools",
    url: "https://www.linkedin.com/company/w3schools-com",
  },
  {
    hashtags: ["#MDN", "#WebDevelopment", "#JavaScript"],
    keywords: [
      "browser",
      "css",
      "dom",
      "event loop",
      "frontend",
      "html",
      "javascript",
      "react",
      "web api",
    ],
    label: "MDN Web Docs",
    linkedInText: "MDN Web Docs",
    url: "https://developer.mozilla.org/",
  },
  {
    hashtags: ["#WebPerformance", "#CoreWebVitals", "#Frontend"],
    keywords: ["core web vitals", "performance", "paint", "rendering", "web performance"],
    label: "web.dev performance guidance",
    linkedInText: "web.dev",
    url: "https://web.dev/",
  },
  {
    hashtags: ["#ReactJS", "#JavaScript", "#Frontend"],
    keywords: ["fiber", "react", "reconciliation", "suspense", "usetransition"],
    label: "React documentation",
    linkedInText: "React",
    url: "https://react.dev/",
  },
  {
    hashtags: ["#OpenAI", "#AIEngineering", "#ArtificialIntelligence"],
    keywords: ["ai", "copilot", "generated ui", "llm", "model", "openai", "prompt"],
    label: "OpenAI developer resources",
    linkedInText: "OpenAI",
    url: "https://platform.openai.com/docs",
  },
  {
    hashtags: ["#NextJS", "#ReactJS", "#WebDevelopment"],
    keywords: ["app router", "next.js", "nextjs", "vercel"],
    label: "Next.js documentation",
    linkedInText: "Next.js",
    url: "https://nextjs.org/docs",
  },
];

function searchablePostText(post: Post) {
  return [
    post.title,
    post.subtitle,
    post.description,
    post.tags.join(" "),
    post.bodyMarkdown.slice(0, 5000),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function recommendedLearningResources(post: Post) {
  const text = searchablePostText(post);
  const matches = resources.filter((resource) =>
    resource.keywords.some((keyword) => text.includes(keyword)),
  );

  return matches.slice(0, 3);
}

export function learningResourceMarkdown(post: Post) {
  const matches = recommendedLearningResources(post);

  if (matches.length === 0) {
    return "";
  }

  return [
    "## Helpful learning resources",
    "",
    ...matches.map((resource) => `- [${resource.label}](${resource.url})`),
  ].join("\n");
}

export function learningResourcePromptContext(post: Post) {
  const matches = recommendedLearningResources(post);

  if (matches.length === 0) {
    return "No extra learning-resource mentions recommended for this article.";
  }

  return [
    "Recommended learning-resource mentions when they fit naturally:",
    ...matches.map(
      (resource) =>
        `- ${resource.linkedInText}: ${resource.url}; hashtags: ${resource.hashtags.join(" ")}`,
    ),
    "Use at most 1-2 in the LinkedIn main post. Prefer useful resource wording over tag spam.",
  ].join("\n");
}

export function learningResourceLinkedInLine(post: Post) {
  const matches = recommendedLearningResources(post);

  if (matches.length === 0) {
    return "";
  }

  return `Helpful resources to keep nearby: ${matches
    .slice(0, 2)
    .map((resource) => `${resource.linkedInText} (${resource.url})`)
    .join(", ")}`;
}

export function learningResourceHashtags(post: Post) {
  return Array.from(
    new Set(recommendedLearningResources(post).flatMap((resource) => resource.hashtags)),
  );
}
