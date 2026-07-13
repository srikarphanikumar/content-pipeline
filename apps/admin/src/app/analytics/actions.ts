"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { collectPlatformMetricSnapshots } from "@/lib/analytics";
import { inngest } from "@/inngest/client";

const manualEvents = {
  "approval-prep": "admin/approval-prep.requested",
  "daily-planning": "admin/daily-planning.requested",
  "draft-buffer": "admin/draft-buffer.requested",
  "morning-summary": "admin/morning-summary.requested",
  "nightly-stats": "admin/nightly-stats.requested",
} as const;

type ManualEventKey = keyof typeof manualEvents;

export async function collectAnalyticsNow() {
  const result = await collectPlatformMetricSnapshots();

  revalidatePath("/analytics");
  redirect(
    `/analytics?manual=${encodeURIComponent(
      `Collected ${result.metricsStored} metric snapshots across ${result.publicationsChecked} publications.`,
    )}`,
  );
}

export async function triggerInngestFunction(key: ManualEventKey) {
  const eventName = manualEvents[key];

  await inngest.send({
    name: eventName,
    data: {
      requestedAt: new Date().toISOString(),
      source: "admin.analytics",
    },
  });

  revalidatePath("/analytics");
  redirect(
    `/analytics?manual=${encodeURIComponent(
      `Triggered ${eventName}. Check Inngest for run details, then refresh this page.`,
    )}`,
  );
}
