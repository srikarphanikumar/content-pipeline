"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

function errorRedirect(code: string, message?: string) {
  const params = new URLSearchParams({ error: code });

  if (message) {
    params.set("message", message.slice(0, 180));
  }

  redirect(`/auth/sign-up?${params.toString()}`);
}

export async function signUpWithEmail(formData: FormData) {
  if (process.env.ALLOW_ADMIN_SIGNUP !== "true") {
    errorRedirect("sign-up-disabled", "Admin sign-up is disabled.");
  }

  const email = (formData.get("email") as string).trim().toLowerCase();
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (allowedEmail && email !== allowedEmail) {
    errorRedirect("not-allowed");
  }

  const { error } = await auth.signUp.email({
    email,
    name: formData.get("name") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    errorRedirect("sign-up-failed", error.message);
  }

  redirect("/");
}
