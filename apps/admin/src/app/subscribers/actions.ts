"use server";

import { revalidatePath } from "next/cache";
import { db } from "@content-pipeline/db";
import type { SubscriberStatus } from "@content-pipeline/db";

const editableStatuses: SubscriberStatus[] = ["ACTIVE", "UNSUBSCRIBED"];

export async function updateSubscriberStatus(subscriberId: string, formData: FormData) {
  const status = formData.get("status");

  if (typeof status !== "string" || !editableStatuses.includes(status as SubscriberStatus)) {
    throw new Error("Unsupported subscriber status.");
  }

  const nextStatus = status as SubscriberStatus;

  await db.subscriber.update({
    where: {
      id: subscriberId,
    },
    data:
      nextStatus === "ACTIVE"
        ? {
            status: nextStatus,
            confirmedAt: new Date(),
            unsubscribedAt: null,
          }
        : {
            status: nextStatus,
            unsubscribedAt: new Date(),
          },
  });

  revalidatePath("/subscribers");
}
