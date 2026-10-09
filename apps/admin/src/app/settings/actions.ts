"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { botHelpText, pipelineBaseUrl, sendBotMessage } from "@/lib/pipeline-bot";
import { setTelegramCommands, setTelegramWebhook } from "@/lib/telegram";

function settingsRedirect(telegram: string, error?: unknown) {
  const params = new URLSearchParams({ telegram });

  if (error) {
    params.set("detail", error instanceof Error ? error.message : "Unknown error.");
  }

  redirect(`/settings?${params.toString()}`);
}

export async function sendTestTelegramMessage() {
  await requireAdmin();

  try {
    await sendBotMessage({
      kind: "TEST",
      text: `✅ <b>Test from the pipeline settings page.</b>\n\n${botHelpText}`,
    });
  } catch (error) {
    settingsRedirect("test-failed", error);
  }

  settingsRedirect("test-sent");
}

// A bot has exactly one webhook. Registering from a preview deployment would silently move
// the bot off production, so this only runs on production (or locally, for a tunnel).
export async function registerTelegramWebhook() {
  await requireAdmin();

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    settingsRedirect("webhook-preview");
  }

  try {
    await setTelegramWebhook(`${pipelineBaseUrl()}/api/telegram/webhook`);
    await setTelegramCommands();
  } catch (error) {
    settingsRedirect("webhook-failed", error);
  }

  settingsRedirect("webhook-registered");
}
