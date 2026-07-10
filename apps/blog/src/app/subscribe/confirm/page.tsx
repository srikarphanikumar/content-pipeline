import Link from "next/link";
import { db } from "@content-pipeline/db";

type ConfirmPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token } = await searchParams;
  let status: "confirmed" | "invalid" = "invalid";

  if (token) {
    const subscriber = await db.subscriber.findUnique({
      where: { confirmationToken: token },
    });

    if (subscriber && subscriber.status !== "UNSUBSCRIBED") {
      await db.subscriber.update({
        where: { id: subscriber.id },
        data: {
          status: "ACTIVE",
          confirmedAt: subscriber.confirmedAt ?? new Date(),
          confirmationToken: null,
        },
      });
      status = "confirmed";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-6 text-[#f7f2ea]">
      <section className="max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
          Newsletter
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
          {status === "confirmed" ? "Subscription confirmed." : "That confirmation link is not valid."}
        </h1>
        <p className="mt-4 leading-7 text-zinc-300">
          {status === "confirmed"
            ? "You are on the list. The next Under The Hood deep dive will land in your inbox."
            : "The link may have already been used or replaced by a newer confirmation email."}
        </p>
        <Link
          className="mt-8 inline-flex h-11 items-center rounded-md bg-orange-500 px-5 text-sm font-semibold text-black transition hover:bg-orange-400"
          href="/"
        >
          Back to the blog
        </Link>
      </section>
    </main>
  );
}
