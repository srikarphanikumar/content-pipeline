// Topics in these statuses no longer count toward the active backlog. "rejected" is set when a
// draft is rejected from the Telegram bot, so the idea is not drafted or suggested again.
export const inactiveTopicStatuses = ["done", "rejected"];

export function isActiveTopicStatus(status: string) {
  return !inactiveTopicStatuses.includes(status);
}
