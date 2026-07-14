import Link from "next/link";
import { db, formatDate } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";
import { SubmitButton } from "../components/SubmitButton";
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

const statusStyles: Record<SubscriberStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  PENDING: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  UNSUBSCRIBED: "bg-white/10 text-zinc-300 ring-white/10",
  BOUNCED: "bg-red-500/15 text-red-300 ring-red-400/30",
};

type SubscribersPageProps = {
  searchParams: Promise<{
    email?: string;
    status?: string;
  }>;
};

const emailMessages: Record<string, string> = {
  "already-sent": "The latest post was already sent to active subscribers.",
  "no-active-subscribers": "No active subscribers were available for a newsletter send.",
  partial: "Newsletter send completed with some failures. Check the delivery log.",
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

  return (
    <AdminShell
      description="Review confirmed readers, pending confirmations, unsubscribe state, and acquisition source."
      eyebrow="Audience"
      title="Subscribers"
    >
      {email ? (
        <div className="mb-6 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-200">
          {emailMessages[email] || `Newsletter action finished: ${email}`}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statuses.map((item) => {
          const href = item === "ALL" ? "/subscribers" : `/subscribers?status=${item}`;
          const count = item === "ALL" ? totalCount : countMap.get(item) || 0;
          const selected = item === "ALL" ? !selectedStatus : selectedStatus === item;

          return (
            <Link
              className={`rounded-lg border p-4 transition ${
                selected
                  ? "border-orange-400 bg-orange-500 text-black"
                  : "border-white/10 bg-[#141414] text-zinc-300 hover:border-orange-400"
              }`}
              href={href}
              key={item}
            >
              <p className="text-sm font-semibold">{statusLabels[item]}</p>
              <p className="mt-2 text-2xl font-semibold">{count}</p>
            </Link>
          );
        })}
      </section>

      <section className="mt-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Newsletter sending
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Send and test subscriber email
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {latestPost
                ? `Test preview uses: ${latestPost.title} (${latestPost.status.replaceAll("_", " ")}).`
                : "No ready or published owned post is available yet."}
              {" "}
              {latestPublishedPost
                ? `Subscriber send uses latest public post: ${latestPublishedPost.title}.`
                : "Subscriber send waits until an owned post is public."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={sendAdminTestNewsletterEmail}>
              <SubmitButton pendingLabel="Sending test...">
                Send admin test email
              </SubmitButton>
            </form>
            <form action={sendLatestPostToActiveSubscribers}>
              <SubmitButton
                className="h-10 rounded-md border border-orange-400 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black disabled:cursor-wait disabled:opacity-70"
                pendingLabel="Sending post..."
              >
                Send latest post
              </SubmitButton>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
        <div className="border-b border-white/10 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
            Delivery log
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Recent email sends</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-black/40 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Kind</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Post</th>
                <th className="px-5 py-3">Recipients</th>
                <th className="px-5 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {emailDeliveries.length > 0 ? (
                emailDeliveries.map((delivery) => (
                  <tr className="text-zinc-300" key={delivery.id}>
                    <td className="px-5 py-4 align-top">{formatDate(delivery.createdAt)}</td>
                    <td className="px-5 py-4 align-top">{delivery.kind}</td>
                    <td className="px-5 py-4 align-top">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          delivery.status === "SENT"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : delivery.status === "PARTIAL"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-4 align-top text-white">
                      {delivery.post?.title || "-"}
                    </td>
                    <td className="px-5 py-4 align-top">
                      {delivery.recipient || delivery.recipientCount}
                    </td>
                    <td className="max-w-md px-5 py-4 align-top text-zinc-400">
                      {delivery.errorMessage || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-center text-zinc-500" colSpan={6}>
                    No email sends recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#141414]">
        {subscribers.length === 0 ? (
          <div className="p-8 text-zinc-400">
            No subscribers match this view yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-black/40 text-left text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Subscriber</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Confirmed</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {subscribers.map((subscriber) => (
                  <tr className="text-zinc-300" key={subscriber.id}>
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-white">{subscriber.email}</p>
                      {subscriber.referrerUrl ? (
                        <p className="mt-1 max-w-sm truncate text-xs text-zinc-500">
                          {subscriber.referrerUrl}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[subscriber.status]}`}
                      >
                        {statusLabels[subscriber.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top">{subscriber.source || "Unknown"}</td>
                    <td className="px-5 py-4 align-top">{formatDate(subscriber.createdAt)}</td>
                    <td className="px-5 py-4 align-top">
                      {subscriber.confirmedAt ? formatDate(subscriber.confirmedAt) : "Not yet"}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {subscriber.status !== "ACTIVE" ? (
                          <form action={updateSubscriberStatus.bind(null, subscriber.id)}>
                            <input name="status" type="hidden" value="ACTIVE" />
                            <SubmitButton
                              className="inline-flex h-9 items-center rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300"
                              pendingLabel="Activating..."
                            >
                              Activate
                            </SubmitButton>
                          </form>
                        ) : null}
                        {subscriber.status !== "UNSUBSCRIBED" ? (
                          <form action={updateSubscriberStatus.bind(null, subscriber.id)}>
                            <input name="status" type="hidden" value="UNSUBSCRIBED" />
                            <SubmitButton
                              className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 text-xs font-semibold text-black"
                              pendingLabel="Updating..."
                            >
                              Unsubscribe
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
