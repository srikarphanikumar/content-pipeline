import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@content-pipeline/db";
import { PostForm } from "../PostForm";
import {
  createDevToDraftForPost,
  generatePromotionAssetsForPost,
  updatePost,
  updatePromotionAssetsForPost,
} from "../actions";

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
    include: {
      publications: true,
      promotionAssets: true,
    },
  });

  if (!post) {
    notFound();
  }

  const updateAction = updatePost.bind(null, post.id);
  const createDevToDraftAction = createDevToDraftForPost.bind(null, post.id);
  const generatePromotionAction = generatePromotionAssetsForPost.bind(null, post.id);
  const updatePromotionAction = updatePromotionAssetsForPost.bind(null, post.id);
  const devToPublication = post.publications.find(
    (publication) => publication.platform === "DEVTO",
  );
  const promotionAssets = new Map(
    post.promotionAssets.map((asset) => [asset.type, asset.content]),
  );
  const hasPromotionAssets = post.promotionAssets.length > 0;

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
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-slate-500">dev.to</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Draft syndication
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Creates an unpublished dev.to draft with the blog URL as canonical
              and a newsletter CTA appended. Cover images are sent when the post
              has one.
            </p>
            {devToPublication?.errorMessage ? (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {devToPublication.errorMessage}
              </p>
            ) : null}
            {devToPublication?.externalUrl ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                dev.to does not serve draft URLs publicly. Open your dev.to
                dashboard to review the draft; this public URL will work after
                publishing.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {devToPublication?.status || "NOT_STARTED"}
            </span>
            {devToPublication?.externalUrl ? (
              <div className="flex flex-col items-start gap-2 md:items-end">
                <a
                  className="text-sm font-semibold text-slate-700 underline"
                  href="https://dev.to/dashboard"
                  rel="noreferrer"
                  target="_blank"
                >
                  Open dev.to dashboard
                </a>
                <a
                  className="text-xs font-medium text-slate-500 underline"
                  href={devToPublication.externalUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Public URL after publish
                </a>
              </div>
            ) : (
              <form action={createDevToDraftAction}>
                <button
                  className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  Create dev.to draft
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-slate-500">Promotion</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Social copy
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Generate LinkedIn and Bluesky copy from the canonical post. Review
              and edit before publishing anywhere.
            </p>
          </div>
          <form action={generatePromotionAction}>
            <button
              className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
              type="submit"
            >
              {hasPromotionAssets ? "Regenerate copy" : "Generate copy"}
            </button>
          </form>
        </div>

        {hasPromotionAssets ? (
          <form action={updatePromotionAction} className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              LinkedIn post
              <textarea
                className="min-h-48 rounded-md border border-slate-300 px-3 py-3 text-sm leading-6 text-slate-950"
                name="linkedInPost"
                defaultValue={promotionAssets.get("LINKEDIN_POST") || ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              LinkedIn first comment
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-3 text-sm leading-6 text-slate-950"
                name="linkedInFirstComment"
                defaultValue={promotionAssets.get("LINKEDIN_FIRST_COMMENT") || ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Bluesky post
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-3 text-sm leading-6 text-slate-950"
                maxLength={300}
                name="blueskyPost"
                defaultValue={promotionAssets.get("BLUESKY_POST") || ""}
              />
            </label>
            <button
              className="h-10 w-fit rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700"
              type="submit"
            >
              Save copy edits
            </button>
          </form>
        ) : null}
      </section>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <PostForm action={updateAction} post={post} />
      </section>
    </main>
  );
}
