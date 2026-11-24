"use client";

import { useEffect } from "react";
import { markPostInboxRead } from "./actions";

// Opening a post marks its inbox notifications read. Runs after mount rather than during the
// server render, so link prefetching never counts as reading. `version` re-runs it after a
// save, so your own edits don't bring the post back as unread.
export function MarkPostRead({ postId, version }: { postId: string; version: string }) {
  useEffect(() => {
    markPostInboxRead(postId).catch(() => undefined);
  }, [postId, version]);

  return null;
}
