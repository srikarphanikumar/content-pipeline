type BlueskySessionResponse = {
  accessJwt: string;
  did: string;
  handle: string;
};

type BlueskyCreateRecordResponse = {
  uri: string;
  cid: string;
};

type BlueskyFacet = {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: Array<
    | {
        $type: "app.bsky.richtext.facet#link";
        uri: string;
      }
    | {
        $type: "app.bsky.richtext.facet#tag";
        tag: string;
      }
  >;
};

const textEncoder = new TextEncoder();

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

function byteIndex(value: string, index: number) {
  return textEncoder.encode(value.slice(0, index)).length;
}

function stripTrailingUrlPunctuation(value: string) {
  return value.replace(/[),.;:!?]+$/g, "");
}

function richTextFacets(text: string) {
  const facets: BlueskyFacet[] = [];
  const occupiedRanges: Array<{ start: number; end: number }> = [];

  for (const match of text.matchAll(/https?:\/\/[^\s]+/g)) {
    if (match.index === undefined) {
      continue;
    }

    const uri = stripTrailingUrlPunctuation(match[0]);
    const start = match.index;
    const end = start + uri.length;

    occupiedRanges.push({ start, end });
    facets.push({
      index: {
        byteStart: byteIndex(text, start),
        byteEnd: byteIndex(text, end),
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri,
        },
      ],
    });
  }

  for (const match of text.matchAll(/(^|[\s(])#([\p{L}\p{N}_]+)/gu)) {
    if (match.index === undefined) {
      continue;
    }

    const prefix = match[1] || "";
    const tag = match[2];
    const start = match.index + prefix.length;
    const end = start + tag.length + 1;
    const overlapsLink = occupiedRanges.some(
      (range) => start < range.end && end > range.start,
    );

    if (overlapsLink) {
      continue;
    }

    facets.push({
      index: {
        byteStart: byteIndex(text, start),
        byteEnd: byteIndex(text, end),
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#tag",
          tag,
        },
      ],
    });
  }

  return facets;
}

export async function publishBlueskyPost(text: string) {
  if (!text.trim()) {
    throw new Error("Bluesky post copy is required.");
  }

  const trimmedText = text.trim().slice(0, 300);
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
        text: trimmedText,
        facets: richTextFacets(trimmedText),
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Bluesky post failed: ${response.status} ${await response.text()}`);
  }

  const record = (await response.json()) as BlueskyCreateRecordResponse;
  const externalUrl = blueskyPostUrl(session.handle, record.uri);

  if (!record.uri || !externalUrl) {
    throw new Error("Bluesky accepted the request but returned no post URL. The post was not marked published.");
  }

  return {
    externalId: record.uri,
    externalUrl,
  };
}
