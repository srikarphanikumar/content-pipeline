import { db } from "@content-pipeline/db";
import { AdminShell, PrimaryLink } from "../components/AdminShell";
import { CopyButton } from "../components/CopyButton";
import { SubmitButton } from "../components/SubmitButton";
import { CaptureTopicModal } from "./CaptureTopicModal";
import { FocusAreasPanel } from "./FocusAreasPanel";
import {
  brainstormTopicsFromForm,
  createDraftPostFromTopic,
  createDraftsForAllSelectedTopics,
  createTopic,
  clearAllTopicsFromForm,
  deleteTopic,
  generateNextBacklogTopicsFromForm,
  prepareNextSelectedTopicDraft,
  selectAllBacklogTopicsFromForm,
  updateTopic,
  updateTopicStatus,
} from "./actions";
import { inactiveTopicStatuses, isActiveTopicStatus } from "@/lib/topic-status";

export const dynamic = "force-dynamic";

const statuses = ["backlog", "selected", "drafting", "ready", "done", "rejected"];

const statusStyles: Record<string, string> = {
  backlog: "bg-white/10 text-zinc-300",
  selected: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30",
  drafting: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  ready: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  done: "bg-zinc-700 text-zinc-300",
};

const ideaCounts = [5, 10, 20];

type TopicsPageProps = {
  searchParams: Promise<{
    area?: string;
    area_error?: string;
    cleared?: string;
    drafted?: string;
    generated?: string;
    moved?: string;
    prepared?: string;
    source?: string;
  }>;
};

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const { area, area_error, cleared, drafted, generated, moved, prepared, source } =
    await searchParams;
  const [topics, publishedPostCount, queuePostCount, focusAreaRows] = await Promise.all([
    db.topic.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        focusArea: {
          select: {
            id: true,
            name: true,
          },
        },
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
    db.focusArea.findMany({
      orderBy: [{ isPreset: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            topics: {
              where: {
                status: {
                  notIn: inactiveTopicStatuses,
                },
              },
            },
          },
        },
      },
    }),
  ]);
  const focusAreas = focusAreaRows.map(({ _count, ...focusArea }) => ({
    ...focusArea,
    activeTopicCount: _count.topics,
  }));
  const activeFocusAreaKey = focusAreas
    .filter((focusArea) => focusArea.active)
    .map((focusArea) => focusArea.id)
    .join(",");
  const areaFilter =
    area === "none" || focusAreas.some((focusArea) => focusArea.id === area) ? area : undefined;
  const matchesArea = (topic: { focusAreaId: string | null }) =>
    !areaFilter || (areaFilter === "none" ? !topic.focusAreaId : topic.focusAreaId === areaFilter);
  const allActiveTopics = topics.filter((topic) => isActiveTopicStatus(topic.status));
  const unassignedCount = allActiveTopics.filter((topic) => !topic.focusAreaId).length;
  const activeTopics = allActiveTopics.filter(matchesArea);
  const doneTopics = topics.filter((topic) => !isActiveTopicStatus(topic.status));
  const backlogCount = activeTopics.filter((topic) => topic.status === "backlog").length;
  const topicTitleText = activeTopics.map((topic) => topic.title).join("\n");
  const areaChips = [
    { href: "/topics", label: "All", count: allActiveTopics.length, selected: !areaFilter },
    ...focusAreas.map((focusArea) => ({
      href: `/topics?area=${focusArea.id}`,
      label: focusArea.name,
      count: focusArea.activeTopicCount,
      selected: areaFilter === focusArea.id,
    })),
    {
      href: "/topics?area=none",
      label: "Unassigned",
      count: unassignedCount,
      selected: areaFilter === "none",
    },
  ];

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
      {generated ? (
        <div className="mb-4 rounded-md border border-orange-400/30 bg-orange-500/10 p-3 text-sm text-orange-100">
          {generated === "error"
            ? "Topic generation failed. Check Vercel logs or use the JSON endpoint for details."
            : `Created ${generated} new topic${generated === "1" ? "" : "s"}${source ? ` via ${source}` : ""}.`}
        </div>
      ) : null}
      {moved ? (
        <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          Moved {moved} backlog topic{moved === "1" ? "" : "s"} to selected.
        </div>
      ) : null}
      {drafted ? (
        <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          Created {drafted} draft post{drafted === "1" ? "" : "s"} from selected topics.
        </div>
      ) : null}
      {cleared ? (
        <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          Cleared {cleared} topic{cleared === "1" ? "" : "s"}.
        </div>
      ) : null}
      {prepared ? (
        <div className="mb-4 rounded-md border border-orange-400/30 bg-orange-500/10 p-3 text-sm text-orange-100">
          {prepared === "0"
            ? "No selected topics without drafts are available."
            : "Could not prepare the selected topic. Check logs and provider credentials."}
        </div>
      ) : null}

      <section className="mb-4 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-300">
            Next-topic engine
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Generate ideas in the areas you pick
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-orange-100/80">
            Ideas are checked against the published archive, the current queue, and existing
            backlog titles so nothing repeats.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-md bg-black/30 px-2 py-1 text-orange-100">
              Published archive: {publishedPostCount}
            </span>
            <span className="rounded-md bg-black/30 px-2 py-1 text-orange-100">
              Queue posts: {queuePostCount}
            </span>
            <span className="rounded-md bg-black/30 px-2 py-1 text-orange-100">
              Backlog topics: {allActiveTopics.length}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            action={generateNextBacklogTopicsFromForm}
            className="grid gap-3 rounded-md border border-orange-400/20 bg-black/30 p-3"
            // Remount when active areas change so the default-checked boxes follow them.
            key={activeFocusAreaKey}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">
              Generate from focus areas
            </p>
            {focusAreas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((focusArea) => (
                  <label
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs font-semibold text-zinc-200 has-[:checked]:border-orange-400 has-[:checked]:text-orange-200"
                    key={focusArea.id}
                  >
                    <input
                      className="accent-orange-500"
                      defaultChecked={focusArea.active}
                      name="focusAreaId"
                      type="checkbox"
                      value={focusArea.id}
                    />
                    {focusArea.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No focus areas yet. Ideas will be a general mix.</p>
            )}
            <p className="text-xs text-zinc-500">
              Nothing checked uses every active area.
            </p>
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border border-white/10 bg-black px-2 text-xs text-white"
                defaultValue={10}
                name="count"
              >
                {ideaCounts.map((count) => (
                  <option key={count} value={count}>
                    {count} ideas
                  </option>
                ))}
              </select>
              <SubmitButton
                className="h-9 rounded-md bg-orange-500 px-3 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-70"
                pendingLabel="Generating..."
              >
                Generate ideas
              </SubmitButton>
            </div>
          </form>

          <form
            action={brainstormTopicsFromForm}
            className="grid gap-3 rounded-md border border-orange-400/20 bg-black/30 p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">
              Brainstorm from a topic
            </p>
            <input
              className="h-9 rounded-md border border-white/10 bg-black px-3 text-sm text-white outline-none ring-orange-500/20 focus:ring-4"
              maxLength={300}
              name="seed"
              placeholder="e.g. Temporal API in fintech dashboards"
              required
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-white/10 bg-black px-2 text-xs text-white"
                defaultValue=""
                name="focusAreaId"
              >
                <option value="">No focus area</option>
                {focusAreas.map((focusArea) => (
                  <option key={focusArea.id} value={focusArea.id}>
                    {focusArea.name}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-white/10 bg-black px-2 text-xs text-white"
                defaultValue={5}
                name="count"
              >
                {[3, 5, 8].map((count) => (
                  <option key={count} value={count}>
                    {count} angles
                  </option>
                ))}
              </select>
              <SubmitButton
                className="h-9 rounded-md bg-orange-500 px-3 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-70"
                pendingLabel="Brainstorming..."
              >
                Brainstorm
              </SubmitButton>
            </div>
          </form>
        </div>
      </section>

      <FocusAreasPanel areaError={area_error} focusAreas={focusAreas} />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#141414] p-3">
        <form action={selectAllBacklogTopicsFromForm}>
          {areaFilter ? <input name="area" type="hidden" value={areaFilter} /> : null}
          <SubmitButton
            className="h-9 rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
            pendingLabel="Selecting..."
          >
            Move all to selected ({backlogCount})
          </SubmitButton>
        </form>
        <form action={prepareNextSelectedTopicDraft}>
          <SubmitButton
            className="h-9 rounded-md border border-emerald-400 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
            pendingLabel="Preparing..."
          >
            Prepare next selected
          </SubmitButton>
        </form>
        <form action={createDraftsForAllSelectedTopics}>
          <SubmitButton
            className="h-9 rounded-md border border-sky-400 px-3 text-xs font-semibold text-sky-300 transition hover:bg-sky-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
            pendingLabel="Drafting..."
          >
            Draft all selected
          </SubmitButton>
        </form>
        <CaptureTopicModal
          action={createTopic}
          defaultFocusAreaId={areaFilter && areaFilter !== "none" ? areaFilter : ""}
          focusAreas={focusAreas}
          statuses={statuses}
        />
        <CopyButton
          className="h-9 rounded-md border border-white/10 px-3 text-xs font-semibold text-zinc-300 transition hover:border-orange-400 hover:text-orange-300"
          value={topicTitleText}
        >
          Copy all topic titles
        </CopyButton>
        <form action={clearAllTopicsFromForm} className="ml-auto">
          <SubmitButton
            className="h-9 rounded-md border border-red-400 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
            pendingLabel="Clearing..."
          >
            Clear all
          </SubmitButton>
        </form>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {counts.map((item) => (
          <section
            className="rounded-lg border border-white/10 bg-[#141414] p-3"
            key={item.status}
          >
            <p className="text-sm capitalize text-zinc-400">{item.status}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{item.count}</p>
          </section>
        ))}
      </div>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter topics by focus area">
        {areaChips.map((chip) => (
          <a
            aria-current={chip.selected ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              chip.selected
                ? "bg-orange-500 text-black"
                : "border border-white/10 text-zinc-300 hover:border-orange-400 hover:text-orange-300"
            }`}
            href={chip.href}
            key={chip.href}
          >
            {chip.label} {chip.count}
          </a>
        ))}
      </nav>

      <div className="mt-3">
        <section className="overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
          {activeTopics.length === 0 ? (
            <div className="p-8 text-zinc-400">
              {areaFilter
                ? "No active topics in this focus area yet. Generate or brainstorm some above."
                : "No active backlog topics yet. Add ideas manually or generate the next set."}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {activeTopics.map((topic) => (
                <article className="grid gap-3 px-4 py-3 xl:grid-cols-[1fr_auto]" key={topic.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-white md:text-lg">
                        {topic.title}
                      </h2>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${statusStyles[topic.status] || statusStyles.backlog}`}
                      >
                        {topic.status}
                      </span>
                      {topic.focusArea ? (
                        <a
                          className="rounded-md border border-orange-400/30 px-2 py-1 text-xs font-semibold text-orange-200 hover:bg-orange-500/10"
                          href={`/topics?area=${topic.focusArea.id}`}
                        >
                          {topic.focusArea.name}
                        </a>
                      ) : null}
                    </div>
                    {topic.description ? (
                      <p className="mt-1 max-w-5xl text-sm leading-6 text-zinc-400">
                        {topic.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-zinc-300">
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
                      {topic.posts[0] ? (
                        <a
                          className="rounded-md bg-orange-500 px-2 py-1 text-black"
                          href={`/posts/${topic.posts[0].id}`}
                        >
                          Open draft
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 xl:max-w-md xl:justify-end">
                    <form action={updateTopicStatus.bind(null, topic.id)} className="flex gap-1">
                      <select
                        className="h-9 rounded-md border border-white/10 bg-black px-2 text-xs text-white"
                        name="status"
                        defaultValue={topic.status}
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="h-9 rounded-md border border-orange-400 px-2.5 text-xs font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
                        pendingLabel="Saving..."
                      >
                        Save
                      </SubmitButton>
                    </form>
                    {topic.posts.length === 0 ? (
                      <form action={createDraftPostFromTopic.bind(null, topic.id)}>
                        <SubmitButton
                          className="h-9 rounded-md bg-orange-500 px-3 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-70"
                          pendingLabel="Drafting..."
                        >
                          Draft
                        </SubmitButton>
                      </form>
                    ) : null}
                    <details className="w-full rounded-md border border-white/10 bg-black/30 p-2 xl:basis-full">
                      <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
                        Edit
                      </summary>
                      <form action={updateTopic.bind(null, topic.id)} className="mt-4 grid gap-3">
                        <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                          Title
                          <input
                            className="h-10 rounded-md border border-white/10 bg-black px-3 text-sm text-white"
                            name="title"
                            required
                            defaultValue={topic.title}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                          Notes
                          <textarea
                            className="min-h-24 rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-white"
                            name="description"
                            defaultValue={topic.description || ""}
                          />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {[
                            ["noveltyScore", "Novelty", topic.noveltyScore],
                            ["audienceFit", "Audience", topic.audienceFit],
                            ["difficulty", "Difficulty", topic.difficulty],
                          ].map(([name, label, value]) => (
                            <label
                              className="grid gap-1 text-xs font-semibold text-zinc-400"
                              key={String(name)}
                            >
                              {label}
                              <input
                                className="h-10 rounded-md border border-white/10 bg-black px-3 text-sm text-white"
                                max={10}
                                min={1}
                                name={String(name)}
                                type="number"
                                defaultValue={typeof value === "number" ? value : ""}
                              />
                            </label>
                          ))}
                        </div>
                        <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                          Focus area
                          <select
                            className="h-10 rounded-md border border-white/10 bg-black px-3 text-sm text-white"
                            name="focusAreaId"
                            defaultValue={topic.focusAreaId || ""}
                          >
                            <option value="">None</option>
                            {focusAreas.map((focusArea) => (
                              <option key={focusArea.id} value={focusArea.id}>
                                {focusArea.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-zinc-400">
                          Status
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
                        </label>
                        <SubmitButton
                          className="h-10 rounded-md bg-orange-500 px-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-70"
                          pendingLabel="Updating..."
                        >
                          Update idea
                        </SubmitButton>
                      </form>
                    </details>
                    <form action={deleteTopic.bind(null, topic.id)}>
                      <SubmitButton
                        className="h-9 rounded-md border border-red-400 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
                        pendingLabel="Deleting..."
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
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
            Done and rejected topics stay out of the active backlog.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {doneTopics.slice(0, 24).map((topic) => (
              <span
                className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300"
                key={topic.id}
              >
                {topic.title}
                {topic.status === "rejected" ? " · rejected" : ""}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
