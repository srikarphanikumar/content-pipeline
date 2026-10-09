import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { decodeCallback, type BotAction } from "@/lib/pipeline-bot";
import { answerTelegramCallback } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  callback_query?: {
    data?: string;
    from: { id: number };
    id: string;
    message?: {
      chat: { id: number };
      message_id: number;
    };
  };
  message?: {
    chat: { id: number };
    from?: { id: number };
    message_id: number;
    reply_to_message?: {
      message_id: number;
    };
    text?: string;
  };
  update_id: number;
};

const callbackToasts: Record<BotAction, string> = {
  approve: "Approving and publishing…",
  draft: "Drafting…",
  improve: "Tell me what to change.",
  reject: "Rejecting…",
  skip: "Finding another topic…",
};

function secretMatches(received: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected || !received) {
    return false;
  }

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

function ok() {
  return NextResponse.json({ ok: true });
}

// Telegram resends an update until it gets a 2xx, so this handler only authenticates the
// update and hands it to Inngest. The event id is the update id, so a resent update cannot
// trigger the same action twice. Everything slow (publishing, OpenAI) runs in Inngest.
export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;

  if (!update || typeof update.update_id !== "number") {
    return ok();
  }

  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  const callback = update.callback_query;
  const message = update.message;
  const chatId = callback?.message?.chat.id ?? message?.chat.id;

  // The bot only works for one private chat. Anything else is dropped without a reply.
  if (!allowedChatId || String(chatId) !== allowedChatId) {
    return ok();
  }

  const eventId = `telegram-update-${update.update_id}`;

  try {
    if (callback) {
      const decoded = decodeCallback(callback.data);

      if (!decoded || !callback.message) {
        await answerTelegramCallback(callback.id, "This button is no longer valid.");
        return ok();
      }

      await inngest.send({
        data: {
          action: decoded.action,
          messageId: callback.message.message_id,
          targetId: decoded.targetId,
        },
        id: eventId,
        name: "telegram/button.tapped",
      });

      // Answer after queuing so a tap is never acknowledged without the work being queued.
      // A failure here only leaves the button spinner up for a few seconds.
      await answerTelegramCallback(callback.id, callbackToasts[decoded.action]).catch((error) =>
        console.error("Failed to answer Telegram callback", error),
      );

      return ok();
    }

    const text = message?.text?.trim();

    if (!message || !text) {
      return ok();
    }

    const command = text.match(/^\/(\w+)(?:@\w+)?/)?.[1]?.toLowerCase();

    if (command === "polish" || !command) {
      await inngest.send({
        data: {
          feedback: command === "polish" ? null : text,
          messageId: message.message_id,
          replyToMessageId: message.reply_to_message?.message_id ?? null,
        },
        id: eventId,
        name: "telegram/feedback.received",
      });

      return ok();
    }

    await inngest.send({
      data: {
        command,
      },
      id: eventId,
      name: "telegram/command.received",
    });

    return ok();
  } catch (error) {
    console.error("Failed to queue Telegram update", error);

    // Non-2xx makes Telegram retry; the event id keeps the retry from doubling up.
    return NextResponse.json({ error: "Failed to queue update" }, { status: 500 });
  }
}
