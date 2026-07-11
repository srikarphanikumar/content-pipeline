type WhatsAppResult =
  | {
      sent: true;
      sid: string;
    }
  | {
      reason: string;
      sent: false;
    };

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM &&
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
        ContentSid: contentSid,
        ContentVariables: JSON.stringify(variables),
        From: normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_FROM as string),
        To: normalizeWhatsAppNumber(process.env.WHATSAPP_TO as string),
      }),
    },
  );

  const result = (await response.json()) as { message?: string; sid?: string };

  if (!response.ok) {
    throw new Error(`Twilio WhatsApp template failed: ${response.status} ${result.message || ""}`);
  }

  return {
    sent: true,
    sid: result.sid || "",
  };
}
