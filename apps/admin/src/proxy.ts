import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /auth/* sign-in and sign-up pages
     * - /api/auth/* Neon Auth handler
     * - /api/inngest (Inngest signs its own requests)
     * - /api/cron/* (guarded by CRON_SECRET)
     * - /api/oauth/linkedin/callback (LinkedIn redirect; validated by OAuth state cookie)
     * - Next.js internals and static files
     */
    "/((?!auth/|api/auth/|api/inngest|api/cron/|api/oauth/linkedin/callback|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
