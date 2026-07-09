import Link from "next/link";
import { PostForm } from "../PostForm";
import { createPost } from "../actions";

export default function NewPostPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <Link className="text-sm font-medium text-slate-500" href="/posts">
        Posts
      </Link>
      <header className="mt-6 border-b border-slate-200 pb-6">
        <h1 className="text-4xl font-semibold tracking-tight">New post</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create a canonical blog post before syndicating it elsewhere.
        </p>
      </header>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <PostForm action={createPost} />
      </section>
    </main>
  );
}
