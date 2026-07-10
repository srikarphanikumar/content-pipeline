import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: ["/", "/posts/:path*", "/import/:path*", "/subscribers/:path*"],
};
