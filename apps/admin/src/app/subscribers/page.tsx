import { db, formatDate } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";
import { Menu } from "../components/Menu";
import { SubmitButton } from "../components/SubmitButton";
import {
  Card,
  EmptyState,
  Notice,
  StatusPill,
  Tabs,
  buttonClass,
  menuDangerItemClass,
  menuItemClass,
  relativeTime,
  type PillTone,
} from "../components/ui";
import {
  sendAdminTestNewsletterEmail,
  sendLatestPostToActiveSubscribers,
  updateSubscriberStatus,
} from "./actions";

export const dynamic = "force-dynamic";

const statuses: Array<SubscriberStatus | "ALL"> = [
  "ALL",
  "ACTIVE",
  "PENDING",
  "UNSUBSCRIBED",
  "BOUNCED",
];

const statusLabels: Record<SubscriberStatus | "ALL", string> = {
  ALL: "All",
  ACTIVE: "Active",
  PENDING: "Pending",
  UNSUBSCRIBED: "Unsubscribed",
  BOUNCED: "Bounced",
};

const statusTones: Record<SubscriberStatus, PillTone> = {
  ACTIVE: "live",
  PENDING: "pending",
  UNSUBSCRIBED: "idle",
  BOUNCED: "failed",
};

type SubscribersPageProps = {
  searchParams: Promise<{
    email?: string;
    status?: string;
  }>;
};

const emailMessages: Record<string, string> = {
  "all-recipients-sent": "This post has already been sent to every active subscriber.",
  "already-sent": "The latest post was already sent to active subscribers.",
  "daily-limit": "Daily newsletter send cap reached. Continue the remaining subscribers tomorrow.",
  "no-active-subscribers": "No active subscribers were available for a newsletter send.",
  "no-published-post": "No published owned post is available for a subscriber send yet.",
  partial: "Newsletter send completed for today's batch. Check the delivery log for remaining subscribers or failures.",
  "sent-post": "Latest post sent to active subscribers.",
  "sent-test": "Test newsletter email sent to the admin address.",
};

function validStatus(status?: string): SubscriberStatus | undefined {
  if (status && statuses.includes(status as SubscriberStatus)) {
    return status === "ALL" ? undefined : (status as SubscriberStatus);
  }

  return undefined;
}

export default async function SubscribersPage({ searchParams }: SubscribersPageProps) {
  const { email, status } = await searchParams;
  const selectedStatus = validStatus(status);
  const where = selectedStatus ? { status: selectedStatus } : {};

  const [subscribers, counts, latestPost, latestPublishedPost, emailDeliveries] = await Promise.all([
    db.subscriber.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    }),
    db.subscriber.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    }),
    db.post.findFirst({
      where: {
        status: {
          in: [
            "READY_TO_PUBLISH",
            "PUBLISHED_BLOG",
            "PUBLISHED_DEVTO",
            "PROMOTED_LINKEDIN",
            "PROMOTED_SOCIAL",
            "COMPLETE",
          ],
        },
        sourcePlatform: null,
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
      },
    }),
    db.post.findFirst({
      where: {
        status: {
          in: [
            "PUBLISHED_BLOG",
            "PUBLISHED_DEVTO",
            "PROMOTED_LINKEDIN",
            "PROMOTED_SOCIAL",
            "COMPLETE",
          ],
        },
        sourcePlatform: null,
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
      },
    }),
    db.emailDelivery.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      include: {
        post: {
          select: {
            title: true,
          },
        },
      },
    }),
  ]);

  const countMap = new Map<SubscriberStatus, number>(
    counts.map((count) => [count.status, count._count.status]),
  );
  const totalCount = counts.reduce((total, count) => total + count._count.status, 0);

  const deliveryTone = (status: string): PillTone =>
    status === "SENT" ? "live" : status === "PARTIAL" ? "pending" : status === "SKIPPED" ? "idle" : "failed";

  return (
    <AdminShell
      actions={
        <>
          {latestPublishedPost ? (
            <form action={sendLatestPostToActiveSubscribers}>
              <SubmitButton
                confirm={`Email "${latestPublishedPost.title}" to every active reader who hasn't had it yet?`}
                pendingLabel="Sending..."
                variant="secondary"
              >
                Send latest post
              </SubmitButton>
            </form>
          ) : null}
          <Menu label="⋯" triggerClassName={buttonClass("secondary")}>
            <form action={sendAdminTestNewsletterEmail}>
              <SubmitButton className={menuItemClass} pendingLabel="Sending test...">
                Send me a test email
              </SubmitButton>
            </form>
          </Menu>
        </>
      }
      description={
        latestPublishedPost
          ? `"Send latest post" emails ${latestPublishedPost.title}. The test email previews ${latestPost?.title || "the same post"}.`
          : "Newsletter sends unlock once a pipeline post is live."
      }
      title="Readers"
    >
      {email ? <Notice>{emailMessages[email] || `Newsletter action finished: ${email}`}</Notice> : null}

      <Card title="Recent sends">
        {emailDeliveries.length > 0 ? (
          <ul className="-mx-5 -my-2 divide-y divide-line">
            {emailDeliveries.map((delivery) => (
              <li className="flex items-start gap-3 px-5 py-2.5 text-sm" key={delivery.id}>
                <span className="w-24 shrink-0">
                  <StatusPill tone={deliveryTone(delivery.status)}>{delivery.status.toLowerCase()}</StatusPill>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-white">
                    {delivery.kind === "TEST" ? "Test · " : ""}
                    {delivery.post?.title || delivery.subject}
                  </p>
                  {delivery.errorMessage ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{delivery.errorMessage}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-right text-xs text-zinc-500">
                  {delivery.recipient || `${delivery.recipientCount} sent`}
                  <br />
                  {relativeTime(delivery.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No email sends recorded yet.</p>
        )}
      </Card>

      <div className="mt-8">
        <Tabs
          items={statuses.map((item) => ({
            active: item === "ALL" ? !selectedStatus : selectedStatus === item,
            count: item === "ALL" ? totalCount : countMap.get(item) || 0,
            href: item === "ALL" ? "/subscribers" : `/subscribers?status=${item}`,
            label: statusLabels[item],
          }))}
        />
        <div className="pt-4">
          {subscribers.length === 0 ? (
            <EmptyState title="No readers in this view" />
          ) : (
            <div className="rounded-xl border border-line bg-surface">
              <table className="min-w-full text-sm">
                <thead className="border-b border-line text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Reader</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Source</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Joined</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {subscribers.map((subscriber) => (
                    <tr className="text-zinc-300" key={subscriber.id}>
                      <td className="max-w-xs px-4 py-2.5">
                        <p className="truncate font-medium text-white">{subscriber.email}</p>
                        {subscriber.referrerUrl ? (
                          <p className="truncate text-xs text-zinc-500">{subscriber.referrerUrl}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={statusTones[subscriber.status]}>{statusLabels[subscriber.status]}</StatusPill>
                      </td>
                      <td className="hidden px-4 py-2.5 text-zinc-400 md:table-cell">{subscriber.source || "—"}</td>
                      <td className="hidden px-4 py-2.5 text-zinc-400 sm:table-cell">{formatDate(subscriber.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Menu label="⋯" triggerClassName={buttonClass("ghost", "sm")}>
                          {subscriber.status !== "ACTIVE" ? (
                            <form action={updateSubscriberStatus.bind(null, subscriber.id)}>
                              <input name="status" type="hidden" value="ACTIVE" />
                              <SubmitButton className={menuItemClass} pendingLabel="Activating...">
                                Mark active
                              </SubmitButton>
                            </form>
                          ) : null}
                          {subscriber.status !== "UNSUBSCRIBED" ? (
                            <form action={updateSubscriberStatus.bind(null, subscriber.id)}>
                              <input name="status" type="hidden" value="UNSUBSCRIBED" />
                              <SubmitButton
                                className={menuDangerItemClass}
                                confirm={`Unsubscribe ${subscriber.email}?`}
                                pendingLabel="Updating..."
                              >
                                Unsubscribe
                              </SubmitButton>
                            </form>
                          ) : null}
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
