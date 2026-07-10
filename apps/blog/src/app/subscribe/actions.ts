"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@content-pipeline/db";
import { blogUrl, sendConfirmationEmail } from "@/lib/newsletter";

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function token() {
  return crypto.randomBytes(32).toString("hex");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribe(formData: FormData) {
  const email = stringValue(formData, "email").toLowerCase();
  const name = stringValue(formData, "name") || null;
  const source = stringValue(formData, "source") || "blog";
  const requestHeaders = await headers();
  const referrerUrl = requestHeaders.get("referer");

  if (!isValidEmail(email)) {
    redirect("/?subscribe=invalid#subscribe");
  }

  const confirmationToken = token();
  const unsubscribeToken = token();

  const existing = await db.subscriber.findUnique({
    where: { email },
  });

  const subscriber = existing
    ? await db.subscriber.update({
        where: { email },
        data: {
          name: name ?? existing.name,
          source,
          referrerUrl,
          status: existing.status === "ACTIVE" ? "ACTIVE" : "PENDING",
          confirmationToken:
            existing.status === "ACTIVE" ? existing.confirmationToken : confirmationToken,
          unsubscribeToken: existing.unsubscribeToken ?? unsubscribeToken,
          unsubscribedAt: null,
        },
      })
    : await db.subscriber.create({
        data: {
          email,
          name,
          source,
          referrerUrl,
          confirmationToken,
          unsubscribeToken,
        },
      });

  if (subscriber.status === "ACTIVE") {
    redirect("/?subscribe=already-active#subscribe");
  }

  const confirmationUrl = blogUrl(
    `/subscribe/confirm?token=${encodeURIComponent(subscriber.confirmationToken || confirmationToken)}`,
  );
  const unsubscribeUrl = blogUrl(
    `/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken || unsubscribeToken)}`,
  );

  const sent = await sendConfirmationEmail({
    email,
    confirmationUrl,
    unsubscribeUrl,
  });

  if (sent) {
    await db.subscriber.update({
      where: { id: subscriber.id },
      data: { lastEmailSentAt: new Date() },
    });
  }

  redirect(sent ? "/?subscribe=pending#subscribe" : "/?subscribe=saved#subscribe");
}
