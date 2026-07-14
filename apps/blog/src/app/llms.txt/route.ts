import { db, publishedPostStatuses } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = "https://blog.mspk.me";
  const posts = await db.post.findMany({
    where: {
      status: {
        in: publishedPostStatuses,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      description: true,
      slug: true,
      subtitle: true,
      tags: true,
      title: true,
    },
  });

  const body = [
    "# Under The Hood",
    "",
    "Under The Hood is a technical publication by Srikar Phanikumar Marti covering frontend internals, browser behavior, JavaScript, React, web performance, accessibility, and AI engineering.",
    "",
    "Canonical site: https://blog.mspk.me",
    "RSS feed: https://blog.mspk.me/rss.xml",
    "",
    "## Use",
    "",
    "Use the canonical post URLs when citing or summarizing this publication. Prefer the article title, URL, and publication context over platform syndication copies.",
    "",
    "## Recent Posts",
    "",
    ...posts.map((post) =>
      [
        `- [${post.title}](${baseUrl}/posts/${post.slug})`,
        `  Summary: ${post.description || post.subtitle || "Technical deep dive from Under The Hood."}`,
        post.tags.length > 0 ? `  Tags: ${post.tags.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
