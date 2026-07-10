import Link from "next/link";
import { db, formatDate } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";
import { updateSubscriberStatus } from "./actions";

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
    status?: string;
  }>;
};

function validStatus(status?: string): SubscriberStatus | undefined {
  if (status && statuses.includes(status as SubscriberStatus)) {
    return status === "ALL" ? undefined : (status as SubscriberStatus);
  }

  return undefined;
}

export default async function SubscribersPage({ searchParams }: SubscribersPageProps) {
  const { status } = await searchParams;
  const selectedStatus = validStatus(status);
  const where = selectedStatus ? { status: selectedStatus } : {};

  const [subscribers, counts] = await Promise.all([
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
                            <button
                              className="inline-flex h-9 items-center rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300"
                              type="submit"
                            >
                              Activate
                            </button>
                          </form>
                        ) : null}
                        {subscriber.status !== "UNSUBSCRIBED" ? (
                          <form action={updateSubscriberStatus.bind(null, subscriber.id)}>
                            <input name="status" type="hidden" value="UNSUBSCRIBED" />
                            <button
                              className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 text-xs font-semibold text-black"
                              type="submit"
                            >
                              Unsubscribe
                            </button>
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
