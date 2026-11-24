import { db } from "@content-pipeline/db";

// Inbox items are derived from live data, so read state is stored per item key. An item is
// unread until it has been read after its latest event (a new failure, a revised draft, ...).
export type InboxReadState = Map<string, Date>;

// Every inbox key that is about one post. Opening the post marks all of them read.
export function inboxKeysForPost(postId: string) {
  return [`failed-${postId}`, `prepare-${postId}`, `approve-${postId}`, `newsletter-${postId}`];
}

export async function loadInboxReadState(keys: string[]): Promise<InboxReadState> {
  if (keys.length === 0) {
    return new Map();
  }

  const rows = await db.inboxRead.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });

  return new Map(rows.map((row) => [row.key, row.readAt]));
}

export function isInboxItemUnread(state: InboxReadState, key: string, eventAt: Date) {
  const readAt = state.get(key);

  return !readAt || readAt < eventAt;
}

export async function markInboxKeysRead(keys: string[]) {
  const readAt = new Date();

  await db.$transaction(
    keys.map((key) =>
      db.inboxRead.upsert({
        where: {
          key,
        },
        create: {
          key,
          readAt,
        },
        update: {
          readAt,
        },
      }),
    ),
  );
}
