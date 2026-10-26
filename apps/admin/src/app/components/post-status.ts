import type { PostStatus } from "@content-pipeline/db";
import type { PillTone } from "./ui";

const statusDisplays: Record<PostStatus, { label: string; tone: PillTone }> = {
  IDEA: { label: "Idea", tone: "idle" },
  SELECTED: { label: "Selected", tone: "idle" },
  DRAFTING: { label: "Drafting", tone: "pending" },
  DRAFT_READY: { label: "Draft ready", tone: "pending" },
  READY_TO_PUBLISH: { label: "Ready", tone: "info" },
  PUBLISHED_BLOG: { label: "Live", tone: "live" },
  PUBLISHED_DEVTO: { label: "Live", tone: "live" },
  PROMOTED_LINKEDIN: { label: "Promoted", tone: "live" },
  PROMOTED_SOCIAL: { label: "Promoted", tone: "live" },
  COMPLETE: { label: "Complete", tone: "live" },
};

export function postStatusDisplay(status: PostStatus) {
  return statusDisplays[status];
}

export const platformLabels: Record<string, string> = {
  BLOG: "Blog",
  BLUESKY: "Bluesky",
  DEVTO: "dev.to",
  LINKEDIN: "LinkedIn",
  MEDIUM: "Medium",
  SUBSTACK: "Substack",
};
