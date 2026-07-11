import { db, formatDate } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";
import { SubmitButton } from "../components/SubmitButton";
import { sendTestWhatsAppNotification } from "./actions";

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
  const whatsAppConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_MESSAGING_SERVICE_SID &&
      process.env.TWILIO_WHATSAPP_FROM &&
      process.env.WHATSAPP_TO &&
      process.env.TWILIO_MORNING_TEMPLATE_SID &&
      process.env.TWILIO_NIGHTLY_TEMPLATE_SID,
  );
  const whatsappDeliveries = await db.notificationDelivery.findMany({
    where: {
      channel: "WHATSAPP",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
  });

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
    {
      title: "WhatsApp",
      eyebrow: "Twilio",
      status: whatsAppConfigured ? "Ready to test" : "Missing env vars",
      tone: whatsAppConfigured ? "ready" : "warning",
      detail: whatsAppConfigured
        ? `Sending to ${process.env.WHATSAPP_TO}. Sender ${process.env.TWILIO_WHATSAPP_FROM}.`
        : "Set Twilio credentials, Messaging Service SID, template SIDs, sender, and recipient.",
      meta: process.env.TWILIO_MESSAGING_SERVICE_SID
        ? `Messaging service: ${process.env.TWILIO_MESSAGING_SERVICE_SID}`
        : "Template sends require TWILIO_MESSAGING_SERVICE_SID.",
      action: (
        <form action={sendTestWhatsAppNotification}>
          <SubmitButton pendingLabel="Sending test...">Send test WhatsApp</SubmitButton>
        </form>
      ),
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

      <section className="mt-6 rounded-lg border border-white/10 bg-[#141414] p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-400">
              Delivery log
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">WhatsApp attempts</h2>
          </div>
          <p className="text-sm text-zinc-500">Latest 8 sends from Twilio/Inngest tests.</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Twilio</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {whatsappDeliveries.length > 0 ? (
                whatsappDeliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(delivery.createdAt)}</td>
                    <td className="px-4 py-3 text-zinc-300">{delivery.kind}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          ["delivered", "sent", "queued", "accepted"].includes(delivery.status)
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                      {delivery.messageSid || delivery.templateSid || "-"}
                    </td>
                    <td className="max-w-md px-4 py-3 text-zinc-400">
                      {delivery.errorCode ? `${delivery.errorCode}: ` : ""}
                      {delivery.errorMessage || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-zinc-500" colSpan={5}>
                    No WhatsApp delivery attempts recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
