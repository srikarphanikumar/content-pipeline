import crypto from "node:crypto";

export const linkedInScopes = ["openid", "profile", "email", "w_member_social"];

type LinkedInTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export type LinkedInUserInfo = {
  sub?: string;
  name?: string;
  email?: string;
};

const linkedInVersion = process.env.LINKEDIN_API_VERSION || "202606";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function linkedInState() {
  return crypto.randomBytes(24).toString("hex");
}

export function linkedInAuthorizationUrl(state: string) {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requiredEnv("LINKEDIN_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("LINKEDIN_REDIRECT_URI"));
  url.searchParams.set("scope", linkedInScopes.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeLinkedInCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: requiredEnv("LINKEDIN_CLIENT_ID"),
    client_secret: requiredEnv("LINKEDIN_CLIENT_SECRET"),
    redirect_uri: requiredEnv("LINKEDIN_REDIRECT_URI"),
  });

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as LinkedInTokenResponse;
}

export async function fetchLinkedInUserInfo(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`LinkedIn userinfo failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as LinkedInUserInfo;
}

function linkedInPostUrl(postUrn: string) {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`;
}

async function uploadLinkedInImage({
  accessToken,
  ownerUrn,
  imageUrl,
}: {
  accessToken: string;
  ownerUrn: string;
  imageUrl: string;
}) {
  const initializeResponse = await fetch(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Linkedin-Version": linkedInVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: ownerUrn,
        },
      }),
    },
  );

  if (!initializeResponse.ok) {
    throw new Error(
      `LinkedIn image upload initialization failed: ${initializeResponse.status} ${await initializeResponse.text()}`,
    );
  }

  const initialized = (await initializeResponse.json()) as {
    value?: {
      uploadUrl?: string;
      image?: string;
    };
  };
  const uploadUrl = initialized.value?.uploadUrl;
  const imageUrn = initialized.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn image upload initialization returned no upload URL.");
  }

  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error(`Could not fetch cover image: ${imageResponse.status} ${await imageResponse.text()}`);
  }

  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
  const imageBytes = await imageResponse.arrayBuffer();
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: imageBytes,
  });

  if (!uploadResponse.ok) {
    throw new Error(`LinkedIn image upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
  }

  return imageUrn;
}

export async function publishLinkedInPost({
  accessToken,
  memberId,
  title,
  text,
  imageUrl,
}: {
  accessToken: string;
  memberId: string;
  title?: string | null;
  text: string;
  imageUrl?: string | null;
}) {
  if (!text.trim()) {
    throw new Error("LinkedIn post copy is required.");
  }

  if (!memberId) {
    throw new Error("LinkedIn member id is missing. Reconnect LinkedIn from Settings.");
  }

  const authorUrn = `urn:li:person:${memberId}`;
  const imageUrn = imageUrl
    ? await uploadLinkedInImage({
        accessToken,
        ownerUrn: authorUrn,
        imageUrl,
      })
    : null;
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Linkedin-Version": linkedInVersion,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text.trim(),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(imageUrn
        ? {
            content: {
              media: {
                altText: title || "Under The Hood article cover image",
                id: imageUrn,
                title: title || "Under The Hood",
              },
            },
          }
        : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn post failed: ${response.status} ${await response.text()}`);
  }

  const postUrn = response.headers.get("x-restli-id");

  if (!postUrn) {
    throw new Error("LinkedIn accepted the request but returned no post id. The post was not marked published.");
  }

  return {
    externalId: postUrn,
    externalUrl: linkedInPostUrl(postUrn),
  };
}
