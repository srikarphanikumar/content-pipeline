import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const neonAuthMiddleware = auth.middleware({
  loginUrl: "/auth/sign-in",
});

function isRedirect(response: Response) {
  return response.status >= 300 && response.status < 400;
}

export default async function proxy(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return neonAuthMiddleware(request);
  }

  // Neon's middleware forwards the incoming method and body to its GET-only get-session
  // endpoint, so every POST (including server actions) looks signed out, gets redirected,
  // and the replayed action 404s on /auth/sign-in. Check the session with a body-less GET
  // instead and let the original request through untouched.
  const sessionCheck = await neonAuthMiddleware(
    new NextRequest(request.url, { headers: request.headers, method: "GET" }),
  );

  if (isRedirect(sessionCheck)) {
    // Server actions call requireAdmin() themselves, which redirects to sign-in in a way the
    // action client understands. Anything else gets a plain 401.
    if (request.headers.has("next-action") && !request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.next();

  for (const cookie of sessionCheck.headers.getSetCookie()) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /auth/* sign-in and sign-up pages
     * - /api/auth/* Neon Auth handler
     * - /api/inngest (Inngest signs its own requests)
     * - /api/cron/* (guarded by CRON_SECRET)
     * - /api/oauth/linkedin/callback (LinkedIn redirect; validated by OAuth state cookie)
     * - /api/telegram/webhook (Telegram bot; validated by the webhook secret header and chat id)
     * - Next.js internals and static files
     */
    "/((?!auth/|api/auth/|api/inngest|api/cron/|api/oauth/linkedin/callback|api/telegram/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
