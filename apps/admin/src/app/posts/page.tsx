import Link from "next/link";
import { db, formatDate, readyPostStatuses } from "@content-pipeline/db";
import { signOut } from "../auth/sign-out/actions";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  const posts = await db.post.findMany({
    orderBy: [{ updatedAt: "desc" }],
  });

  const readyCount = posts.filter((post) =>
    readyPostStatuses.includes(post.status),
  ).length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <Link className="text-sm font-medium text-slate-500" href="/">
            Dashboard
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Posts</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ready buffer: {readyCount} / 20
          </p>
        </div>
        <div className="flex gap-2">
          <form action={signOut}>
            <button
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700"
              type="submit"
            >
              Sign out
            </button>
          </form>
          <Link
            className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
            href="/posts/new"
          >
            New post
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white">
        {posts.length === 0 ? (
          <div className="p-8 text-slate-600">
            No posts yet. Create a demo post or import the Substack archive.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {posts.map((post) => (
              <article className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between" key={post.id}>
                <div>
                  <h2 className="text-lg font-semibold">
                    <Link href={`/posts/${post.id}`}>{post.title}</Link>
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {post.status} · {formatDate(post.publishedAt || post.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
