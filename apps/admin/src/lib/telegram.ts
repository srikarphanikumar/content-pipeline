const maxMessageLength = 4096;

export type InlineButton =
  | {
      callback_data: string;
      text: string;
    }
  | {
      text: string;
      url: string;
    };

export type InlineKeyboard = InlineButton[][];

export type TelegramMessage = {
  chat: {
    id: number;
  };
  message_id: number;
  text?: string;
};

export type TelegramWebhookInfo = {
  last_error_date?: number;
  last_error_message?: string;
  pending_update_count: number;
  url: string;
};

type TelegramResponse<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      description?: string;
      error_code?: number;
      ok: false;
    };

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly errorCode: number | undefined,
    description: string,
  ) {
    super(`Telegram ${method} failed${errorCode ? ` (${errorCode})` : ""}: ${description}`);
  }
}

export function telegramConfigured() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_CHAT_ID &&
      process.env.TELEGRAM_WEBHOOK_SECRET,
  );
}

export function telegramChatId() {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    throw new Error("Missing TELEGRAM_CHAT_ID.");
  }

  return chatId;
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function truncateText(value: string, maxLength: number) {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

// Messages are built from escaped parts, so this only trips on unexpectedly huge content.
// Cutting HTML mid-tag makes Telegram reject the message, so fall back to plain text.
function fitMessage(html: string) {
  if (html.length <= maxMessageLength) {
    return { parseMode: "HTML" as const, text: html };
  }

  const plain = html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  return { parseMode: undefined, text: truncateText(plain, maxMessageLength) };
}

async function callTelegram<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN.");
  }

  // TELEGRAM_API_BASE is for a self-hosted Bot API server or a local fake; it defaults to
  // Telegram's cloud API. Never log this URL: the bot token is part of the path.
  const apiBase = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
  const response = await fetch(`${apiBase}/bot${token}/${method}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as TelegramResponse<T> | null;

  if (!result) {
    throw new TelegramApiError(method, response.status, "Unreadable response.");
  }

  if (!result.ok) {
    throw new TelegramApiError(method, result.error_code, result.description || "Unknown error.");
  }

  return result.result;
}

export async function sendTelegramMessage(input: {
  forceReplyPlaceholder?: string;
  keyboard?: InlineKeyboard;
  replyToMessageId?: number;
  text: string;
}) {
  const { parseMode, text } = fitMessage(input.text);
  const replyMarkup = input.keyboard
    ? { inline_keyboard: input.keyboard }
    : input.forceReplyPlaceholder
      ? { force_reply: true, input_field_placeholder: input.forceReplyPlaceholder.slice(0, 64) }
      : undefined;

  return callTelegram<TelegramMessage>("sendMessage", {
    chat_id: telegramChatId(),
    link_preview_options: { is_disabled: true },
    parse_mode: parseMode,
    reply_markup: replyMarkup,
    reply_parameters: input.replyToMessageId
      ? { allow_sending_without_reply: true, message_id: input.replyToMessageId }
      : undefined,
    text,
  });
}

function isNotModified(error: unknown) {
  return error instanceof TelegramApiError && /message is not modified/i.test(error.message);
}

// Passing no keyboard removes the buttons, which is how handled cards are retired.
export async function editTelegramMessage(input: {
  keyboard?: InlineKeyboard;
  messageId: number;
  text: string;
}) {
  const { parseMode, text } = fitMessage(input.text);

  try {
    await callTelegram<TelegramMessage | true>("editMessageText", {
      chat_id: telegramChatId(),
      link_preview_options: { is_disabled: true },
      message_id: input.messageId,
      parse_mode: parseMode,
      reply_markup: { inline_keyboard: input.keyboard || [] },
      text,
    });
  } catch (error) {
    if (!isNotModified(error)) {
      throw error;
    }
  }
}

export async function clearTelegramKeyboard(messageId: number) {
  try {
    await callTelegram<TelegramMessage | true>("editMessageReplyMarkup", {
      chat_id: telegramChatId(),
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  } catch (error) {
    if (!isNotModified(error)) {
      throw error;
    }
  }
}

export async function answerTelegramCallback(callbackQueryId: string, text?: string) {
  await callTelegram<true>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text?.slice(0, 200),
  });
}

export async function setTelegramWebhook(url: string) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing TELEGRAM_WEBHOOK_SECRET.");
  }

  await callTelegram<true>("setWebhook", {
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    secret_token: secret,
    url,
  });
}

export async function getTelegramWebhookInfo() {
  return callTelegram<TelegramWebhookInfo>("getWebhookInfo", {});
}

export async function setTelegramCommands() {
  await callTelegram<true>("setMyCommands", {
    commands: [
      {
        command: "next",
        description: "Show the next post waiting for approval",
      },
    ],
  });
}
