import { AdminShell, SecondaryLink } from "../../components/AdminShell";
import { PostForm } from "../PostForm";
import { createPost } from "../actions";

export default function NewPostPage() {
  return (
    <AdminShell
      actions={<SecondaryLink href="/posts">All posts</SecondaryLink>}
      description="Create the canonical article first. Syndication and promotion happen after the owned copy is ready."
      eyebrow="Publishing"
      title="New post"
    >
      <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
        <PostForm action={createPost} />
      </section>
    </AdminShell>
  );
}
