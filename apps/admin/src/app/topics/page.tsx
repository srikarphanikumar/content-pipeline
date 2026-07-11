import { db } from "@content-pipeline/db";
import { AdminShell, PrimaryLink } from "../components/AdminShell";
import { createTopic, generateNextBacklogTopics, updateTopicStatus } from "./actions";

export const dynamic = "force-dynamic";

const statuses = ["backlog", "selected", "drafting", "ready", "done"];

const statusStyles: Record<string, string> = {
  backlog: "bg-white/10 text-zinc-300",
  selected: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30",
  drafting: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  ready: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  done: "bg-zinc-700 text-zinc-300",
};

export default async function TopicsPage() {
  const [topics, publishedPostCount, queuePostCount] = await Promise.all([
    db.topic.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        posts: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
    db.post.count({
      where: {
        OR: [
          {
            sourcePlatform: "SUBSTACK",
          },
          {
            publishedAt: {
              not: null,
            },
          },
        ],
      },
    }),
    db.post.count({
      where: {
        status: {
          in: ["IDEA", "SELECTED", "DRAFTING", "DRAFT_READY", "READY_TO_PUBLISH"],
        },
      },
    }),
  ]);
  const activeTopics = topics.filter((topic) => topic.status !== "done");
  const doneTopics = topics.filter((topic) => topic.status === "done");

  const counts = statuses.map((status) => ({
    status,
    count: topics.filter((topic) => topic.status === status).length,
  }));

  return (
    <AdminShell
      actions={<PrimaryLink href="/posts/new">Create post</PrimaryLink>}
      description="Track new article ideas before they become drafts. This is the missing buffer between inspiration and the 20-post ready queue."
      eyebrow="Planning"
      title="Topic backlog"
    >
      <section className="mb-6 grid gap-4 rounded-lg border border-orange-400/30 bg-orange-500/10 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-300">
            Next-topic engine
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Build the backlog from what already shipped
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-100/80">
            This checks the published archive, the current queue, and existing
            backlog titles, then adds fresh future-facing topic ideas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-md bg-black/30 px-2 py-1 text-orange-100">
              Published archive: {publishedPostCount}
            </span>
            <span className="rounded-md bg-black/30 px-2 py-1 text-orange-100">
              Queue posts: {queuePostCount}
            </span>
            <span className="rounded-md bg-black/30 px-2 py-1 text-orange-100">
              Backlog topics: {activeTopics.length}
            </span>
          </div>
        </div>
        <form action={generateNextBacklogTopics}>
          <button
            className="h-11 rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
            type="submit"
          >
            Suggest next topics
          </button>
        </form>
      </section>

      <div className="grid gap-3 md:grid-cols-5">
        {counts.map((item) => (
          <section
            className="rounded-lg border border-white/10 bg-[#141414] p-4"
            key={item.status}
          >
            <p className="text-sm capitalize text-zinc-400">{item.status}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{item.count}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
        <section className="rounded-lg border border-white/10 bg-[#141414] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
            Add topic
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Capture a new idea
          </h2>
          <form action={createTopic} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-zinc-300">
              Title
              <input
                className="h-11 rounded-md border border-white/10 bg-black px-3 text-white outline-none ring-orange-500/20 focus:ring-4"
                name="title"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-zinc-300">
              Notes
              <textarea
                className="min-h-28 rounded-md border border-white/10 bg-black px-3 py-3 text-white outline-none ring-orange-500/20 focus:ring-4"
                name="description"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["noveltyScore", "Novelty"],
                ["audienceFit", "Audience"],
                ["difficulty", "Difficulty"],
              ].map(([name, label]) => (
                <label className="grid gap-2 text-sm font-semibold text-zinc-300" key={name}>
                  {label}
                  <input
                    className="h-11 rounded-md border border-white/10 bg-black px-3 text-white outline-none ring-orange-500/20 focus:ring-4"
                    max={10}
                    min={1}
                    name={name}
                    type="number"
                  />
                </label>
              ))}
            </div>
            <label className="grid gap-2 text-sm font-semibold text-zinc-300">
              Status
              <select
                className="h-11 rounded-md border border-white/10 bg-black px-3 text-white outline-none ring-orange-500/20 focus:ring-4"
                name="status"
                defaultValue="backlog"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-10 w-fit rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
              type="submit"
            >
              Add topic
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
          {activeTopics.length === 0 ? (
            <div className="p-8 text-zinc-400">
              No active backlog topics yet. Add ideas manually or generate the next set.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {activeTopics.map((topic) => (
                <article className="grid gap-4 p-5 xl:grid-cols-[1fr_auto]" key={topic.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{topic.title}</h2>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${statusStyles[topic.status] || statusStyles.backlog}`}
                      >
                        {topic.status}
                      </span>
                    </div>
                    {topic.description ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {topic.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-300">
                      <span className="rounded-md bg-white/10 px-2 py-1">
                        Novelty {topic.noveltyScore || "-"}
                      </span>
                      <span className="rounded-md bg-white/10 px-2 py-1">
                        Audience {topic.audienceFit || "-"}
                      </span>
                      <span className="rounded-md bg-white/10 px-2 py-1">
                        Difficulty {topic.difficulty || "-"}
                      </span>
                      <span className="rounded-md bg-white/10 px-2 py-1">
                        Posts {topic.posts.length}
                      </span>
                    </div>
                  </div>
                  <form action={updateTopicStatus.bind(null, topic.id)} className="flex gap-2">
                    <select
                      className="h-10 rounded-md border border-white/10 bg-black px-3 text-sm text-white"
                      name="status"
                      defaultValue={topic.status}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      className="h-10 rounded-md border border-orange-400 px-3 text-sm font-semibold text-orange-300"
                      type="submit"
                    >
                      Save
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {doneTopics.length > 0 ? (
        <section className="mt-6 rounded-lg border border-white/10 bg-[#141414] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Completed ideas
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Done topics stay out of the active backlog.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {doneTopics.slice(0, 24).map((topic) => (
              <span
                className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300"
                key={topic.id}
              >
                {topic.title}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
