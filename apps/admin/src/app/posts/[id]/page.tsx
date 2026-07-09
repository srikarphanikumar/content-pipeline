import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@content-pipeline/db";
import { PostForm } from "../PostForm";
import { updatePost } from "../actions";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const post = await db.post.findUnique({
    where: {
      id,
    },
  });

  if (!post) {
    notFound();
  }

  const updateAction = updatePost.bind(null, post.id);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Link className="text-sm font-medium text-slate-500" href="/posts">
          Posts
        </Link>
        <a
          className="text-sm font-medium text-slate-600"
          href={`https://blog.mspk.me/posts/${post.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          View public URL
        </a>
      </div>
      <header className="mt-6 border-b border-slate-200 pb-6">
        <h1 className="text-4xl font-semibold tracking-tight">Edit post</h1>
        <p className="mt-2 text-sm text-slate-600">
          Update the canonical copy and publishing status.
        </p>
      </header>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <PostForm action={updateAction} post={post} />
      </section>
    </main>
  );
}
