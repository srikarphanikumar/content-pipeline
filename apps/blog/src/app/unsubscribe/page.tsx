import Link from "next/link";
import { db } from "@content-pipeline/db";

type UnsubscribePageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams;
  let status: "unsubscribed" | "invalid" = "invalid";

  if (token) {
    const subscriber = await db.subscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (subscriber) {
      await db.subscriber.update({
        where: { id: subscriber.id },
        data: {
          status: "UNSUBSCRIBED",
          unsubscribedAt: new Date(),
          confirmationToken: null,
        },
      });
      status = "unsubscribed";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-6 text-[#f7f2ea]">
      <section className="max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
          Newsletter
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
          {status === "unsubscribed" ? "You are unsubscribed." : "That unsubscribe link is not valid."}
        </h1>
        <p className="mt-4 leading-7 text-zinc-300">
          {status === "unsubscribed"
            ? "No more newsletter emails will be sent to this address."
            : "The link may be missing, expired, or replaced by a newer email."}
        </p>
        <Link
          className="mt-8 inline-flex h-11 items-center rounded-md border border-white/15 px-5 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-300"
          href="/"
        >
          Back to the blog
        </Link>
      </section>
    </main>
  );
}
