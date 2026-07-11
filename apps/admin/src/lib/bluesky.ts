type BlueskySessionResponse = {
  accessJwt: string;
  did: string;
  handle: string;
};

type BlueskyCreateRecordResponse = {
  uri: string;
  cid: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function createBlueskySession() {
  const response = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: requiredEnv("BLUESKY_HANDLE"),
      password: requiredEnv("BLUESKY_APP_PASSWORD"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Bluesky session failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as BlueskySessionResponse;
}

function blueskyPostUrl(handle: string, uri: string) {
  const rkey = uri.split("/").pop();

  if (!rkey) {
    return null;
  }

  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

export async function publishBlueskyPost(text: string) {
  if (!text.trim()) {
    throw new Error("Bluesky post copy is required.");
  }

  const session = await createBlueskySession();
  const response = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: text.trim().slice(0, 300),
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Bluesky post failed: ${response.status} ${await response.text()}`);
  }

  const record = (await response.json()) as BlueskyCreateRecordResponse;

  return {
    externalId: record.uri,
    externalUrl: blueskyPostUrl(session.handle, record.uri),
  };
}
