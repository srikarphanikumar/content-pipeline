import Link from "next/link";
import { db } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";
import { CopyButton } from "../components/CopyButton";
import { Menu } from "../components/Menu";
import { SubmitButton } from "../components/SubmitButton";
import {
  ButtonLink,
  Card,
  EmptyState,
  Notice,
  StatusPill,
  Tabs,
  buttonClass,
  menuDangerItemClass,
  menuItemClass,
  type PillTone,
} from "../components/ui";
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

const statusTones: Record<string, PillTone> = {
  backlog: "idle",
  selected: "info",
  drafting: "pending",
  ready: "live",
};
const statusTabs = ["backlog", "selected", "drafting", "ready"];

const ideaCounts = [5, 10, 20];

const fieldClass =
  "h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-white outline-none focus:border-zinc-500";
const fieldLabelClass = "grid gap-1 text-xs font-medium text-zinc-400";

type TopicsPageProps = {
  searchParams: Promise<{
    area?: string;
    area_error?: string;
    status?: string;
    cleared?: string;
    drafted?: string;
    generated?: string;
    moved?: string;
    prepared?: string;
    source?: string;
  }>;
};

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const { area, area_error, cleared, drafted, generated, moved, prepared, source, status } =
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
  const areaTopics = allActiveTopics.filter(matchesArea);
  const statusFilter = status && statusTabs.includes(status) ? status : undefined;
  const activeTopics = areaTopics.filter((topic) => !statusFilter || topic.status === statusFilter);
  const doneTopics = topics.filter((topic) => !isActiveTopicStatus(topic.status));
  const backlogCount = areaTopics.filter((topic) => topic.status === "backlog").length;
  const topicTitleText = activeTopics.map((topic) => topic.title).join("\n");
  const topicsHref = (next: { area?: string; status?: string }) => {
    const params = new URLSearchParams();

    if (next.area) {
      params.set("area", next.area);
    }

    if (next.status) {
      params.set("status", next.status);
    }

    return params.size > 0 ? `/topics?${params.toString()}` : "/topics";
  };
  const areaChips = [
    { href: topicsHref({ status: statusFilter }), label: "All areas", count: allActiveTopics.length, selected: !areaFilter },
    ...focusAreas.map((focusArea) => ({
      href: topicsHref({ area: focusArea.id, status: statusFilter }),
      label: focusArea.name,
      count: focusArea.activeTopicCount,
      selected: areaFilter === focusArea.id,
    })),
    {
      href: topicsHref({ area: "none", status: statusFilter }),
      label: "Unassigned",
      count: unassignedCount,
      selected: areaFilter === "none",
    },
  ];
  const notice = generated
    ? generated === "error"
      ? { tone: "failed" as const, text: "Topic generation failed. Check the Vercel logs." }
      : {
          tone: "live" as const,
          text: `Created ${generated} new idea${generated === "1" ? "" : "s"}${source ? ` via ${source}` : ""}.`,
        }
    : moved
      ? { tone: "live" as const, text: `Moved ${moved} backlog idea${moved === "1" ? "" : "s"} to selected.` }
      : drafted
        ? { tone: "live" as const, text: `Created ${drafted} draft${drafted === "1" ? "" : "s"} from selected ideas.` }
        : cleared
          ? { tone: "pending" as const, text: `Cleared ${cleared} idea${cleared === "1" ? "" : "s"}.` }
          : prepared
            ? {
                tone: "pending" as const,
                text:
                  prepared === "0"
                    ? "No selected ideas without drafts are available."
                    : "Couldn't prepare the selected idea. Check the logs and provider credentials.",
              }
            : null;

  return (
    <AdminShell
      actions={
        <>
          <CaptureTopicModal
            action={createTopic}
            defaultFocusAreaId={areaFilter && areaFilter !== "none" ? areaFilter : ""}
            focusAreas={focusAreas}
            statuses={statuses}
          />
          <Menu label="⋯" triggerClassName={buttonClass("secondary")}>
            <form action={selectAllBacklogTopicsFromForm}>
              {areaFilter ? <input name="area" type="hidden" value={areaFilter} /> : null}
              <SubmitButton className={menuItemClass} pendingLabel="Selecting...">
                Select all backlog ({backlogCount})
              </SubmitButton>
            </form>
            <form action={prepareNextSelectedTopicDraft}>
              <SubmitButton className={menuItemClass} pendingLabel="Preparing...">
                Draft & prepare next selected
              </SubmitButton>
            </form>
            <form action={createDraftsForAllSelectedTopics}>
              <SubmitButton className={menuItemClass} pendingLabel="Drafting...">
                Draft all selected
              </SubmitButton>
            </form>
            <CopyButton className={menuItemClass} value={topicTitleText}>
              Copy titles in view
            </CopyButton>
            <div className="my-1 border-t border-line" />
            <form action={clearAllTopicsFromForm}>
              <SubmitButton
                className={menuDangerItemClass}
                confirm="Delete every idea, including done and rejected ones? This can't be undone."
                pendingLabel="Clearing..."
              >
                Clear all ideas
              </SubmitButton>
            </form>
          </Menu>
        </>
      }
      description={`${allActiveTopics.length} active ideas · ${publishedPostCount} published posts and ${queuePostCount} in the queue are checked for repeats.`}
      title="Ideas"
    >
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <Tabs
            items={[
              {
                active: !statusFilter,
                count: areaTopics.length,
                href: topicsHref({ area: areaFilter }),
                label: "All",
              },
              ...statusTabs.map((item) => ({
                active: statusFilter === item,
                count: areaTopics.filter((topic) => topic.status === item).length,
                href: topicsHref({ area: areaFilter, status: item }),
                label: item[0].toUpperCase() + item.slice(1),
              })),
            ]}
          />

          <nav aria-label="Filter ideas by focus area" className="flex flex-wrap gap-1.5 pt-3">
            {areaChips.map((chip) => (
              <Link
                aria-current={chip.selected ? "page" : undefined}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  chip.selected
                    ? "bg-white/[0.12] text-white"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                }`}
                href={chip.href}
                key={chip.href}
              >
                {chip.label} <span className="text-zinc-500">{chip.count}</span>
              </Link>
            ))}
          </nav>

          <div className="pt-3">
            {activeTopics.length === 0 ? (
              <EmptyState title="No ideas here">
                Generate or brainstorm some from the panel on the right.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {activeTopics.map((topic) => (
                  <li className="px-4 py-3" key={topic.id}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">{topic.title}</p>
                          <StatusPill tone={statusTones[topic.status] || "idle"}>{topic.status}</StatusPill>
                        </div>
                        {topic.description ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-400">{topic.description}</p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-zinc-500">
                          {topic.focusArea ? (
                            <Link className="hover:text-zinc-200" href={topicsHref({ area: topic.focusArea.id })}>
                              {topic.focusArea.name}
                            </Link>
                          ) : (
                            "No area"
                          )}
                          {" · "}Novelty {topic.noveltyScore || "–"} · Audience {topic.audienceFit || "–"} ·
                          Difficulty {topic.difficulty || "–"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {topic.posts[0] ? (
                          <ButtonLink href={`/posts/${topic.posts[0].id}`} size="sm">
                            Open draft
                          </ButtonLink>
                        ) : (
                          <>
                            {topic.status === "backlog" ? (
                              <form action={updateTopicStatus.bind(null, topic.id)}>
                                <input name="status" type="hidden" value="selected" />
                                <SubmitButton pendingLabel="..." size="sm" variant="ghost">
                                  Select
                                </SubmitButton>
                              </form>
                            ) : null}
                            <form action={createDraftPostFromTopic.bind(null, topic.id)}>
                              <SubmitButton pendingLabel="Drafting..." size="sm" variant="secondary">
                                Draft
                              </SubmitButton>
                            </form>
                          </>
                        )}
                        <Menu label="⋯" triggerClassName={buttonClass("ghost", "sm")}>
                          {statuses
                            .filter((item) => item !== topic.status)
                            .map((item) => (
                              <form action={updateTopicStatus.bind(null, topic.id)} key={item}>
                                <input name="status" type="hidden" value={item} />
                                <SubmitButton className={menuItemClass} pendingLabel="Saving...">
                                  Move to {item}
                                </SubmitButton>
                              </form>
                            ))}
                          <div className="my-1 border-t border-line" />
                          <form action={deleteTopic.bind(null, topic.id)}>
                            <SubmitButton
                              className={menuDangerItemClass}
                              confirm={`Delete "${topic.title}"?`}
                              pendingLabel="Deleting..."
                            >
                              Delete idea
                            </SubmitButton>
                          </form>
                        </Menu>
                      </div>
                    </div>
                    <details className="group mt-1">
                      <summary className="w-fit cursor-pointer list-none text-xs text-zinc-500 hover:text-zinc-200">
                        Edit details
                      </summary>
                      <form action={updateTopic.bind(null, topic.id)} className="mt-3 grid gap-3 rounded-lg border border-line bg-canvas p-3">
                        <label className={fieldLabelClass}>
                          Title
                          <input className={fieldClass} defaultValue={topic.title} name="title" required />
                        </label>
                        <label className={fieldLabelClass}>
                          Notes
                          <textarea
                            className={`${fieldClass} h-auto py-2`}
                            defaultValue={topic.description || ""}
                            name="description"
                            rows={3}
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-5">
                          {[
                            ["noveltyScore", "Novelty", topic.noveltyScore],
                            ["audienceFit", "Audience", topic.audienceFit],
                            ["difficulty", "Difficulty", topic.difficulty],
                          ].map(([name, label, value]) => (
                            <label className={fieldLabelClass} key={String(name)}>
                              {label}
                              <input
                                className={fieldClass}
                                defaultValue={typeof value === "number" ? value : ""}
                                max={10}
                                min={1}
                                name={String(name)}
                                type="number"
                              />
                            </label>
                          ))}
                          <label className={fieldLabelClass}>
                            Focus area
                            <select className={fieldClass} defaultValue={topic.focusAreaId || ""} name="focusAreaId">
                              <option value="">None</option>
                              {focusAreas.map((focusArea) => (
                                <option key={focusArea.id} value={focusArea.id}>
                                  {focusArea.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={fieldLabelClass}>
                            Status
                            <select className={fieldClass} defaultValue={topic.status} name="status">
                              {statuses.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div>
                          <SubmitButton pendingLabel="Saving..." size="sm" variant="secondary">
                            Save idea
                          </SubmitButton>
                        </div>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {doneTopics.length > 0 ? (
            <details className="mt-6">
              <summary className="cursor-pointer list-none text-sm text-zinc-400 hover:text-white">
                {doneTopics.length} done or rejected ideas ›
              </summary>
              <ul className="mt-3 grid gap-1 text-sm text-zinc-400">
                {doneTopics.map((topic) => (
                  <li key={topic.id}>
                    {topic.title}
                    {topic.status === "rejected" ? <span className="text-zinc-600"> · rejected</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <aside className="grid h-fit min-w-0 grid-cols-1 gap-4">
          <Card description="Checked against everything already published or queued." title="Generate ideas">
            <form
              action={generateNextBacklogTopicsFromForm}
              className="grid gap-3"
              // Remount when active areas change so the default-checked boxes follow them.
              key={activeFocusAreaKey}
            >
              {focusAreas.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {focusAreas.map((focusArea) => (
                    <label
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-zinc-400 has-[:checked]:border-zinc-400 has-[:checked]:text-white"
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
                <p className="text-xs text-zinc-500">No focus areas yet, so ideas will be a general mix.</p>
              )}
              <div className="flex items-center gap-2">
                <select className={`${fieldClass} flex-1`} defaultValue={10} name="count">
                  {ideaCounts.map((count) => (
                    <option key={count} value={count}>
                      {count} ideas
                    </option>
                  ))}
                </select>
                <SubmitButton pendingLabel="Generating...">Generate</SubmitButton>
              </div>
            </form>
          </Card>

          <Card description="Spin several angles out of one seed." title="Brainstorm">
            <form action={brainstormTopicsFromForm} className="grid gap-2">
              <input
                className={fieldClass}
                maxLength={300}
                name="seed"
                placeholder="e.g. Temporal API in fintech dashboards"
                required
              />
              <div className="flex items-center gap-2">
                <select className={`${fieldClass} min-w-0 flex-1`} defaultValue="" name="focusAreaId">
                  <option value="">No focus area</option>
                  {focusAreas.map((focusArea) => (
                    <option key={focusArea.id} value={focusArea.id}>
                      {focusArea.name}
                    </option>
                  ))}
                </select>
                <select className={fieldClass} defaultValue={5} name="count">
                  {[3, 5, 8].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
                <SubmitButton pendingLabel="Thinking..." variant="secondary">
                  Go
                </SubmitButton>
              </div>
            </form>
          </Card>
        </aside>
      </div>

      <details className="mt-8 rounded-xl border border-line bg-surface px-5 py-4" open={Boolean(area_error)}>
        <summary className="cursor-pointer list-none font-semibold text-white">
          Manage focus areas{" "}
          <span className="text-sm font-normal text-zinc-500">
            · {focusAreas.filter((focusArea) => focusArea.active).length} active
          </span>
        </summary>
        <div className="mt-3">
          <FocusAreasPanel areaError={area_error} focusAreas={focusAreas} />
        </div>
      </details>
    </AdminShell>
  );
}
