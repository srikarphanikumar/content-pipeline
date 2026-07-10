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
