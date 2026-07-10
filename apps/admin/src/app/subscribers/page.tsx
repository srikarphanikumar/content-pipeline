import Link from "next/link";
import { db, formatDate } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";
import { signOut } from "../auth/sign-out/actions";
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
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  UNSUBSCRIBED: "bg-slate-100 text-slate-600 ring-slate-200",
  BOUNCED: "bg-red-50 text-red-700 ring-red-200",
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
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <Link className="text-sm font-medium text-slate-500" href="/">
            Dashboard
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Subscribers
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {countMap.get("ACTIVE") || 0} active of {totalCount} total subscribers.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            href="/posts"
          >
            Posts
          </Link>
          <form action={signOut}>
            <button
              className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statuses.map((item) => {
          const href = item === "ALL" ? "/subscribers" : `/subscribers?status=${item}`;
          const count = item === "ALL" ? totalCount : countMap.get(item) || 0;
          const selected = item === "ALL" ? !selectedStatus : selectedStatus === item;

          return (
            <Link
              className={`rounded-lg border p-4 ${
                selected
                  ? "border-slate-950 bg-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
              href={href}
              key={item}
            >
              <p className="text-sm font-medium">{statusLabels[item]}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{count}</p>
            </Link>
          );
        })}
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {subscribers.length === 0 ? (
          <div className="p-8 text-slate-600">
            No subscribers match this view yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Subscriber</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Confirmed</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {subscribers.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-slate-950">{subscriber.email}</p>
                      {subscriber.referrerUrl ? (
                        <p className="mt-1 max-w-sm truncate text-xs text-slate-500">
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
                    <td className="px-5 py-4 align-top text-slate-600">
                      {subscriber.source || "Unknown"}
                    </td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      {formatDate(subscriber.createdAt)}
                    </td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      {subscriber.confirmedAt ? formatDate(subscriber.confirmedAt) : "Not yet"}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {subscriber.status !== "ACTIVE" ? (
                          <form action={updateSubscriberStatus.bind(null, subscriber.id)}>
                            <input name="status" type="hidden" value="ACTIVE" />
                            <button
                              className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700"
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
                              className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white"
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
    </main>
  );
}
