import { db } from "@content-pipeline/db";
import { credentialWarnings, findApprovalCandidate } from "@/lib/pipeline-bot";
import { approvableStatuses } from "@/lib/post-workflow";
import { escapeHtml, truncateText } from "@/lib/telegram";
import { inactiveTopicStatuses } from "@/lib/topic-status";

const timeZone = "America/New_York";

// Midnight today in New York, as a UTC instant. Works across DST because the offset is read
// for today's date rather than assumed.
export function startOfTodayNewYork(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")
    ?.value.replace("GMT", "");

  return new Date(`${day}T00:00:00${offset && offset !== "" ? offset : "-05:00"}`);
}

type Skip = {
  publicationId: string;
  reason: string;
};

const platformRows = [
  { emoji: "👩‍💻", label: "dev.to", metrics: ["views", "reactions", "comments"], platform: "DEVTO" },
  { emoji: "💼", label: "LinkedIn", metrics: ["reactions", "comments"], platform: "LINKEDIN" },
  { emoji: "🦋", label: "Bluesky", metrics: ["likes", "reposts", "replies", "quotes"], platform: "BLUESKY" },
] as const;

function formatCount(value: number, name: string) {
  const singular = name.endsWith("s") ? name.slice(0, -1) : name;
  const label = value === 1 ? singular : name;

  return `<b>${value.toLocaleString("en-US")}</b> ${label}`;
}

function headerDate(now: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "long",
  }).format(now);
}

// The nightly Telegram report: how the post that went out this morning is doing, measured from
// the stats collected a moment ago, plus what is lined up for tomorrow.
export async function buildNightlyReport(collection: { capturedAt: Date; skipped: Skip[] }) {
  const now = new Date();
  const todayStart = startOfTodayNewYork(now);
  const [posts, warnings, candidate, readyCount, activeTopicCount] = await Promise.all([
    db.post.findMany({
      where: {
        sourcePlatform: null,
        publishedAt: {
          gte: todayStart,
          lte: now,
        },
      },
      orderBy: { publishedAt: "asc" },
      include: {
        emailDeliveries: {
          where: { kind: "NEWSLETTER_POST" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        publications: {
          include: {
            metricSnapshots: {
              where: { capturedAt: { gte: collection.capturedAt } },
            },
          },
        },
      },
    }),
    credentialWarnings({ withinDays: 7 }),
    findApprovalCandidate(),
    db.post.count({
      where: { sourcePlatform: null, status: { in: approvableStatuses } },
    }),
    db.topic.count({ where: { status: { notIn: inactiveTopicStatuses } } }),
  ]);
  const skipsByPublication = new Map(collection.skipped.map((skip) => [skip.publicationId, skip.reason]));
  const lines: string[] = [`🌙 <b>Nightly report</b> · ${escapeHtml(headerDate(now))}`];

  if (warnings.length > 0) {
    lines.push("", ...warnings.map((warning) => `⚠️ <b>${escapeHtml(warning)}</b>`));
  }

  if (posts.length === 0) {
    lines.push("", "😴 Nothing went out today.");
  }

  for (const post of posts) {
    const blog = post.publications.find((publication) => publication.platform === "BLOG");
    const newsletter = post.emailDeliveries[0];
    const blogLine = blog?.externalUrl
      ? `🌐 <a href="${escapeHtml(blog.externalUrl)}">Live on the blog</a>`
      : "🌐 Live on the blog";
    const newsletterLine = !newsletter
      ? "📧 Newsletter not sent"
      : newsletter.status === "SENT"
        ? `📧 Newsletter sent to <b>${newsletter.recipientCount.toLocaleString("en-US")}</b> readers`
        : `📧 Newsletter ${escapeHtml(newsletter.status.toLowerCase())}: ${newsletter.recipientCount.toLocaleString("en-US")} sent`;

    lines.push("", `📰 <b>${escapeHtml(truncateText(post.title, 200))}</b>`, `${blogLine}  ·  ${newsletterLine}`, "");

    for (const row of platformRows) {
      const publication = post.publications.find((item) => item.platform === row.platform);
      const prefix = `${row.emoji} <b>${row.label}</b>`;

      if (!publication || publication.status === "NOT_STARTED" || publication.status === "GENERATED") {
        lines.push(`${prefix}  ·  not posted`);
        continue;
      }

      if (publication.status === "FAILED") {
        lines.push(
          `${prefix}  ·  ❌ ${escapeHtml(truncateText(publication.errorMessage || "failed to publish", 160))}`,
        );
        continue;
      }

      const values = new Map(
        publication.metricSnapshots.map((snapshot) => [snapshot.metricName, snapshot.metricValue]),
      );
      const counts = row.metrics
        .filter((metric) => values.has(metric))
        .filter((metric, index) => index === 0 || (values.get(metric) ?? 0) > 0)
        .map((metric) => formatCount(values.get(metric) ?? 0, metric));
      const skip = skipsByPublication.get(publication.id);

      if (counts.length === 0) {
        lines.push(`${prefix}  ·  ⚠️ no stats tonight${skip ? `: ${escapeHtml(truncateText(skip, 140))}` : ""}`);
        continue;
      }

      const link = publication.externalUrl ? ` <a href="${escapeHtml(publication.externalUrl)}">↗</a>` : "";

      lines.push(`${prefix}  ·  ${counts.join(" · ")}${link}`);

      if (skip) {
        lines.push(`      <i>${escapeHtml(truncateText(skip, 140))}</i>`);
      }
    }
  }

  lines.push(
    "",
    "🗓 <b>Tomorrow</b>",
    candidate
      ? `Up next: ${escapeHtml(truncateText(candidate.title, 160))}`
      : "Nothing is ready to publish. Use /next to draft a topic.",
    `${readyCount} draft${readyCount === 1 ? "" : "s"} ready  ·  ${activeTopicCount} topics in the backlog`,
  );

  return lines.join("\n");
}
