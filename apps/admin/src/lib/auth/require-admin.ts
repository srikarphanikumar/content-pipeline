import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export function isAllowedAdminEmail(email: string | null | undefined) {
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  return !allowedEmail || normalizedEmail === allowedEmail;
}

export async function getAdminUser() {
  const { data } = await auth.getSession();
  const user = data?.user;

  return user && isAllowedAdminEmail(user.email) ? user : null;
}

// Proxy only covers matched routes, so every server action re-checks the session itself.
export async function requireAdmin() {
  const user = await getAdminUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}
