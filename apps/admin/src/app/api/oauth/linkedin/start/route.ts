import { NextResponse } from "next/server";
import { linkedInAuthorizationUrl, linkedInState } from "@/lib/linkedin";

export async function GET() {
  const state = linkedInState();
  const response = NextResponse.redirect(linkedInAuthorizationUrl(state));

  response.cookies.set("linkedin_oauth_state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
