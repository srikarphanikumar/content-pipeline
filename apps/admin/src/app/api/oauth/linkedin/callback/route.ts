import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@content-pipeline/db";
import { exchangeLinkedInCode, fetchLinkedInUserInfo } from "@/lib/linkedin";

function settingsUrl(request: NextRequest, status: string) {
  return new URL(`/settings?linkedin=${encodeURIComponent(status)}`, request.url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("linkedin_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(settingsUrl(request, error));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(settingsUrl(request, "invalid-state"));
  }

  try {
    const token = await exchangeLinkedInCode(code);
    const userInfo = await fetchLinkedInUserInfo(token.access_token);
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;

    await db.platformConnection.upsert({
      where: {
        platform: "LINKEDIN",
      },
      create: {
        platform: "LINKEDIN",
        providerAccountId: userInfo.sub || null,
        displayName: userInfo.name || null,
        email: userInfo.email || null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        scope: token.scope || null,
        tokenType: token.token_type || null,
        expiresAt,
      },
      update: {
        providerAccountId: userInfo.sub || null,
        displayName: userInfo.name || null,
        email: userInfo.email || null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || null,
        scope: token.scope || null,
        tokenType: token.token_type || null,
        expiresAt,
      },
    });
  } catch (callbackError) {
    console.error(callbackError);
    return NextResponse.redirect(settingsUrl(request, "failed"));
  }

  const response = NextResponse.redirect(settingsUrl(request, "connected"));
  response.cookies.delete("linkedin_oauth_state");
  return response;
}
