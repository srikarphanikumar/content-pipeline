"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { inboxKeysForPost, markInboxKeysRead } from "@/lib/inbox";

// Keys are capped so a crafted request can't write an unbounded number of rows.
function cleanKeys(keys: string[]) {
  return keys.filter((key) => typeof key === "string" && key.length <= 300).slice(0, 200);
}

export async function markInboxItemsRead(keys: string[]) {
  await requireAdmin();
  await markInboxKeysRead(cleanKeys(keys));
  revalidatePath("/");
}

export async function markPostInboxRead(postId: string) {
  await requireAdmin();
  await markInboxKeysRead(inboxKeysForPost(postId));
  revalidatePath("/");
}
