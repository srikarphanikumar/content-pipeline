type DevToStats = {
  comments?: number;
  reactions?: number;
  views?: number;
};

type BlueskyStats = {
  likes?: number;
  quotes?: number;
  replies?: number;
  reposts?: number;
};

export async function fetchDevToStats(articleId: string): Promise<DevToStats | null> {
  if (!process.env.DEVTO_API_KEY) {
    return null;
  }

  const response = await fetch(`https://dev.to/api/articles/${articleId}`, {
    headers: {
      "api-key": process.env.DEVTO_API_KEY,
    },
  });

  if (!response.ok) {
    return null;
  }

  const article = (await response.json()) as {
    comments_count?: number;
    page_views_count?: number;
    public_reactions_count?: number;
  };

  return {
    comments: article.comments_count,
    reactions: article.public_reactions_count,
    views: article.page_views_count,
  };
}

// The public article endpoint has no view counts; dev.to only returns page_views_count to the
// author, from the signed-in /articles/me endpoints. One paged listing covers every article.
export async function fetchDevToMyArticleStats(): Promise<Map<string, DevToStats>> {
  const stats = new Map<string, DevToStats>();

  if (!process.env.DEVTO_API_KEY) {
    return stats;
  }

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://dev.to/api/articles/me/published?per_page=1000&page=${page}`,
      {
        headers: {
          "api-key": process.env.DEVTO_API_KEY,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`dev.to returned ${response.status} for your published articles`);
    }

    const articles = (await response.json()) as Array<{
      comments_count?: number;
      id: number;
      page_views_count?: number;
      public_reactions_count?: number;
    }>;

    for (const article of articles) {
      stats.set(String(article.id), {
        comments: article.comments_count,
        reactions: article.public_reactions_count,
        views: article.page_views_count,
      });
    }

    if (articles.length < 1000) {
      break;
    }
  }

  return stats;
}

export async function fetchBlueskyStats(uri: string): Promise<BlueskyStats | null> {
  const url = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts");
  url.searchParams.append("uris", uri);
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as {
    posts?: Array<{
      likeCount?: number;
      quoteCount?: number;
      replyCount?: number;
      repostCount?: number;
    }>;
  };
  const post = result.posts?.[0];

  if (!post) {
    return null;
  }

  return {
    likes: post.likeCount,
    quotes: post.quoteCount,
    replies: post.replyCount,
    reposts: post.repostCount,
  };
}
