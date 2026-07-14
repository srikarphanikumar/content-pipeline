import type { MetadataRoute } from "next";
import { db, publishedPostStatuses } from "@content-pipeline/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://blog.mspk.me";
  const posts = await db.post.findMany({
    where: {
      status: {
        in: publishedPostStatuses,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: posts[0]?.publishedAt || posts[0]?.updatedAt || new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-07-11"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-07-11"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/posts/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
