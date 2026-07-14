import { db, publishedPostStatuses } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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
  });

  const items = posts
    .map((post) => {
      const url = `${baseUrl}/posts/${post.slug}`;
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${url}</link>
          <guid>${url}</guid>
          <description>${escapeXml(post.description || post.subtitle || "")}</description>
          <pubDate>${(post.publishedAt || post.createdAt).toUTCString()}</pubDate>
          ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("")}
        </item>`;
    })
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>Under The Hood</title>
        <link>${baseUrl}</link>
        <description>Deep technical essays on frontend internals, browser behavior, JavaScript, React, web performance, accessibility, and AI engineering.</description>
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${items}
      </channel>
    </rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
