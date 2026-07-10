import Link from "next/link";
import { db, formatDate } from "@content-pipeline/db";
import { signOut } from "../auth/sign-out/actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{
    linkedin?: string;
  }>;
};

const linkedInMessages: Record<string, string> = {
  connected: "LinkedIn is connected.",
  failed: "LinkedIn connection failed. Check credentials, redirect URI, and scopes.",
  "invalid-state": "LinkedIn connection failed state validation. Try connecting again.",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { linkedin } = await searchParams;
  const linkedInConnection = await db.platformConnection.findUnique({
    where: {
      platform: "LINKEDIN",
    },
  });
  const message = linkedin ? linkedInMessages[linkedin] || `LinkedIn returned: ${linkedin}` : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <Link className="text-sm font-medium text-slate-500" href="/">
            Dashboard
          </Link>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-slate-600">
            Connect external platforms used by the content pipeline.
          </p>
        </div>
        <form action={signOut}>
          <button
            className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>

      {message ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-slate-500">LinkedIn</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Social promotion account
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Connect LinkedIn so the pipeline can create promotion posts after
              dev.to syndication.
            </p>
            {linkedInConnection ? (
              <div className="mt-4 grid gap-1 text-sm text-slate-600">
                <p>
                  Connected as{" "}
                  <span className="font-semibold text-slate-950">
                    {linkedInConnection.displayName || linkedInConnection.email || "LinkedIn member"}
                  </span>
                </p>
                <p>Token expires: {formatDate(linkedInConnection.expiresAt)}</p>
              </div>
            ) : null}
          </div>
          <a
            className="inline-flex h-10 w-fit items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
            href="/api/oauth/linkedin/start"
          >
            {linkedInConnection ? "Reconnect LinkedIn" : "Connect LinkedIn"}
          </a>
        </div>
      </section>
    </main>
  );
}
