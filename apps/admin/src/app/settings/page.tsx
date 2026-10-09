import { db, formatDate } from "@content-pipeline/db";
import { AdminShell } from "../components/AdminShell";
import { SubmitButton } from "../components/SubmitButton";
import { pipelineBaseUrl } from "@/lib/pipeline-bot";
import { getTelegramWebhookInfo, telegramConfigured } from "@/lib/telegram";
import { registerTelegramWebhook, sendTestTelegramMessage } from "./actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{
    detail?: string;
    linkedin?: string;
    telegram?: string;
  }>;
};

const linkedInMessages: Record<string, string> = {
  connected: "LinkedIn is connected.",
  failed: "LinkedIn connection failed. Check credentials, redirect URI, and scopes.",
  "invalid-state": "LinkedIn connection failed state validation. Try connecting again.",
};

const telegramMessages: Record<string, string> = {
  "test-failed": "Telegram test message failed.",
  "test-sent": "Telegram test message sent. Check the bot chat.",
  "webhook-failed": "Telegram webhook registration failed.",
  "webhook-preview":
    "Register the Telegram webhook from production only. A bot has one webhook, and a preview URL would take it over.",
  "webhook-registered": "Telegram webhook registered. Button taps and replies now reach the pipeline.",
};

async function getTelegramDeliveries() {
  try {
    const deliveries = await db.notificationDelivery.findMany({
      where: {
        channel: "TELEGRAM",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    });

    return {
      deliveries,
      error: null,
    };
  } catch (error) {
    console.error("Failed to load Telegram delivery log", error);

    return {
      deliveries: [],
      error:
        "Delivery log is not available yet. Run the latest database migration and redeploy.",
    };
  }
}

async function getWebhookStatus() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return null;
  }

  try {
    const info = await getTelegramWebhookInfo();
    const expectedUrl = `${pipelineBaseUrl()}/api/telegram/webhook`;

    return {
      error: info.last_error_message || null,
      pending: info.pending_update_count,
      registered: info.url === expectedUrl,
      url: info.url,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not reach Telegram.",
      pending: 0,
      registered: false,
      url: "",
    };
  }
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { detail, linkedin, telegram } = await searchParams;
  const linkedInConnection = await db.platformConnection.findUnique({
    where: {
      platform: "LINKEDIN",
    },
  });
  const message = linkedin
    ? linkedInMessages[linkedin] || `LinkedIn returned: ${linkedin}`
    : telegram
      ? `${telegramMessages[telegram] || `Telegram: ${telegram}`}${detail ? ` ${detail}` : ""}`
      : null;
  const blueskyHandle = process.env.BLUESKY_HANDLE;
  const blueskyConfigured = Boolean(blueskyHandle && process.env.BLUESKY_APP_PASSWORD);
  const devToConfigured = Boolean(process.env.DEVTO_API_KEY);
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const telegramReady = telegramConfigured();
  const [{ deliveries: telegramDeliveries, error: telegramDeliveryError }, webhook] =
    await Promise.all([getTelegramDeliveries(), getWebhookStatus()]);
  const telegramStatus = !telegramReady
    ? "Missing env vars"
    : webhook?.registered
      ? webhook.error
        ? "Webhook errors"
        : "Ready"
      : "Webhook not registered";

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
      title: "Telegram",
      eyebrow: "Bot",
      status: telegramStatus,
      tone: telegramStatus === "Ready" ? "ready" : "warning",
      detail: telegramReady
        ? `Morning approval cards and nightly stats go to chat ${process.env.TELEGRAM_CHAT_ID}. Approve, Improve and Reject run from the buttons.`
        : "Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and TELEGRAM_WEBHOOK_SECRET.",
      meta: webhook
        ? webhook.registered
          ? `Webhook: ${webhook.url}${webhook.pending ? ` · ${webhook.pending} pending` : ""}${
              webhook.error ? ` · Last error: ${webhook.error}` : ""
            }`
          : `Webhook: ${webhook.url || "not set"}${webhook.error ? ` · ${webhook.error}` : ""}`
        : null,
      action: telegramReady ? (
        <div className="flex flex-wrap gap-3">
          <form action={sendTestTelegramMessage}>
            <SubmitButton pendingLabel="Sending test...">Send test message</SubmitButton>
          </form>
          <form action={registerTelegramWebhook}>
            <SubmitButton pendingLabel="Registering...">
              {webhook?.registered ? "Re-register webhook" : "Register webhook"}
            </SubmitButton>
          </form>
        </div>
      ) : null,
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
            <h2 className="mt-2 text-2xl font-semibold text-white">Telegram messages</h2>
          </div>
          <p className="text-sm text-zinc-500">Latest 8 messages sent by the bot.</p>
        </div>

        {telegramDeliveryError ? (
          <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {telegramDeliveryError}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {telegramDeliveries.length > 0 ? (
                telegramDeliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(delivery.createdAt)}</td>
                    <td className="px-4 py-3 text-zinc-300">{delivery.kind}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          ["sent", "answered"].includes(delivery.status)
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                      {delivery.messageId || "-"}
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
                    No Telegram messages recorded yet.
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
