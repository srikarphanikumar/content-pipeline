import { db, formatDate } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";

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
  const blueskyHandle = process.env.BLUESKY_HANDLE;
  const blueskyConfigured = Boolean(blueskyHandle && process.env.BLUESKY_APP_PASSWORD);
  const devToConfigured = Boolean(process.env.DEVTO_API_KEY);
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);

  const cards = [
    {
      title: "LinkedIn",
      eyebrow: "OAuth",
      status: linkedInConnection ? "Connected" : "Needs connection",
      tone: linkedInConnection ? "ready" : "warning",
      detail: linkedInConnection
        ? `Connected as ${linkedInConnection.displayName || linkedInConnection.email || "LinkedIn member"}`
        : "Connect before posting promotion copy from the pipeline.",
      meta: linkedInConnection ? `Token expires ${formatDate(linkedInConnection.expiresAt)}` : null,
      action: (
        <a
          className="inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
          href="/api/oauth/linkedin/start"
        >
          {linkedInConnection ? "Reconnect LinkedIn" : "Connect LinkedIn"}
        </a>
      ),
    },
    {
      title: "Bluesky",
      eyebrow: "App password",
      status: blueskyConfigured ? "Ready" : "Missing env vars",
      tone: blueskyConfigured ? "ready" : "warning",
      detail: blueskyHandle ? `Handle: ${blueskyHandle}` : "Set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD.",
      meta: "Used for short-form promotion posts.",
      action: null,
    },
    {
      title: "dev.to",
      eyebrow: "API key",
      status: devToConfigured ? "Ready" : "Missing API key",
      tone: devToConfigured ? "ready" : "warning",
      detail: "Creates draft articles with canonical links back to the blog.",
      meta: "Draft-first publishing flow.",
      action: null,
    },
    {
      title: "OpenAI",
      eyebrow: "Generation",
      status: openAiConfigured ? "Ready" : "Missing API key",
      tone: openAiConfigured ? "ready" : "warning",
      detail: "Generates LinkedIn and Bluesky promotion copy.",
      meta: "Used server-side only.",
      action: null,
    },
  ];

  return (
    <AdminShell
      description="Review provider connections and server-side credentials used by syndication, promotion, and generation workflows."
      eyebrow="Configuration"
      title="Settings"
    >
      {message ? (
        <div className="mb-6 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <section
            className="rounded-lg border border-white/10 bg-[#141414] p-5"
            key={card.title}
          >
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
                  {card.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{card.detail}</p>
                {card.meta ? (
                  <p className="mt-2 text-sm text-zinc-500">{card.meta}</p>
                ) : null}
              </div>
              <span
                className={`w-fit rounded-md px-3 py-1 text-xs font-semibold ${
                  card.tone === "ready"
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                    : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30"
                }`}
              >
                {card.status}
              </span>
            </div>
            {card.action ? <div className="mt-5">{card.action}</div> : null}
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
