"use server";

import { revalidatePath } from "next/cache";
import { db } from "@content-pipeline/db";
import {
  pollTwilioMessageStatus,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp";

function envSummary() {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_MORNING_TEMPLATE_SID",
    "WHATSAPP_TO",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing WhatsApp env vars: ${missing.join(", ")}`);
  }
}

async function recordDelivery(input: Parameters<typeof db.notificationDelivery.create>[0]["data"]) {
  try {
    await db.notificationDelivery.create({
      data: input,
    });
  } catch (error) {
    console.error("Failed to record WhatsApp delivery", error);
  }
}

export async function sendTestWhatsAppNotification() {
  envSummary();

  const notificationDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date());
  const detail =
    "Manual admin test from the Under The Hood pipeline. If this arrives, production WhatsApp template delivery is working.";
  const body = `Under The Hood morning summary for ${notificationDate}:\n\n${detail}\n\nReply STOP to opt out.`;

  try {
    const result = await sendWhatsAppTemplate(
      process.env.TWILIO_MORNING_TEMPLATE_SID,
      {
        "1": notificationDate,
        "2": detail,
      },
      body,
    );

    if (!result.sent) {
      await recordDelivery({
        bodyPreview: body,
        channel: "WHATSAPP",
        errorMessage: result.reason,
        kind: "TEST",
        recipient: process.env.WHATSAPP_TO as string,
        status: "not_sent",
        templateSid: process.env.TWILIO_MORNING_TEMPLATE_SID,
      });
      revalidatePath("/settings");
      return;
    }

    const status = await pollTwilioMessageStatus(result.sid);

    await recordDelivery({
      bodyPreview: body,
      channel: "WHATSAPP",
      errorCode: status.errorCode,
      errorMessage: status.errorMessage,
      kind: "TEST",
      messageSid: result.sid,
      recipient: process.env.WHATSAPP_TO as string,
      status: status.status,
      templateSid: process.env.TWILIO_MORNING_TEMPLATE_SID,
    });
  } catch (error) {
    await recordDelivery({
      bodyPreview: body,
      channel: "WHATSAPP",
      errorMessage: error instanceof Error ? error.message : "Unknown WhatsApp test error",
      kind: "TEST",
      recipient: process.env.WHATSAPP_TO || "unknown",
      status: "failed",
      templateSid: process.env.TWILIO_MORNING_TEMPLATE_SID,
    });
    throw error;
  }

  revalidatePath("/settings");
}
