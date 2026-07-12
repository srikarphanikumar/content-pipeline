type WhatsAppResult =
  | {
      sent: true;
      sid: string;
      status: string;
    }
  | {
      reason: string;
      sent: false;
    };

export type TwilioMessageStatus = {
  errorCode: string | null;
  errorMessage: string | null;
  sid: string;
  status: string;
};

const terminalStatuses = new Set([
  "delivered",
  "failed",
  "undelivered",
  "read",
]);

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM &&
      process.env.WHATSAPP_TO,
  );
}

function twilioTemplateConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_MESSAGING_SERVICE_SID &&
      process.env.WHATSAPP_TO,
  );
}

function normalizeWhatsAppNumber(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

export async function sendWhatsAppMessage(body: string): Promise<WhatsAppResult> {
  if (!twilioConfigured()) {
    return {
      reason:
        "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, or WHATSAPP_TO.",
      sent: false,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN as string;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Body: body,
        From: normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_FROM as string),
        To: normalizeWhatsAppNumber(process.env.WHATSAPP_TO as string),
      }),
    },
  );

  const result = (await response.json()) as { message?: string; sid?: string };

  if (!response.ok) {
    throw new Error(`Twilio WhatsApp failed: ${response.status} ${result.message || ""}`);
  }

  return {
    sent: true,
    sid: result.sid || "",
    status: "accepted",
  };
}

export async function sendWhatsAppTemplate(
  contentSid: string | undefined,
  variables: Record<string, string>,
  fallbackBody: string,
): Promise<WhatsAppResult> {
  if (!contentSid) {
    return sendWhatsAppMessage(fallbackBody);
  }

  if (!twilioTemplateConfigured()) {
    return {
      reason:
        "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, or WHATSAPP_TO.",
      sent: false,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN as string;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        ContentSid: contentSid,
        ContentVariables: JSON.stringify(variables),
        MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID as string,
        To: normalizeWhatsAppNumber(process.env.WHATSAPP_TO as string),
      }),
    },
  );

  const result = (await response.json()) as {
    error_code?: string | null;
    error_message?: string | null;
    message?: string;
    sid?: string;
    status?: string;
  };

  if (!response.ok) {
    throw new Error(`Twilio WhatsApp template failed: ${response.status} ${result.message || ""}`);
  }

  return {
    sent: true,
    sid: result.sid || "",
    status: result.status || "accepted",
  };
}

export async function fetchTwilioMessageStatus(
  messageSid: string,
): Promise<TwilioMessageStatus> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    },
  );

  const result = (await response.json()) as {
    error_code?: string | null;
    error_message?: string | null;
    message?: string;
    sid?: string;
    status?: string;
  };

  if (!response.ok) {
    throw new Error(`Twilio status fetch failed: ${response.status} ${result.message || ""}`);
  }

  return {
    errorCode: result.error_code ? String(result.error_code) : null,
    errorMessage: result.error_message || null,
    sid: result.sid || messageSid,
    status: result.status || "unknown",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollTwilioMessageStatus(
  messageSid: string,
): Promise<TwilioMessageStatus> {
  let latest = await fetchTwilioMessageStatus(messageSid);

  for (const delay of [3000, 7000, 15000]) {
    if (terminalStatuses.has(latest.status)) {
      return latest;
    }

    await sleep(delay);
    latest = await fetchTwilioMessageStatus(messageSid);
  }

  return latest;
}
