"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { isAllowedAdminEmail } from "@/lib/auth/require-admin";

function errorRedirect(message?: string) {
  const params = new URLSearchParams({ error: "invalid-credentials" });

  if (message) {
    params.set("message", message.slice(0, 180));
  }

  redirect(`/auth/sign-in?${params.toString()}`);
}

export async function signInWithEmail(formData: FormData) {
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();

  if (!isAllowedAdminEmail(email)) {
    errorRedirect();
  }

  const { error } = await auth.signIn.email({
    email,
    password: formData.get("password") as string,
  });

  if (error) {
    errorRedirect(error.message);
  }

  redirect("/");
}
