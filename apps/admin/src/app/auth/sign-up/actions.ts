"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signUpWithEmail(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase();
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (allowedEmail && email !== allowedEmail) {
    redirect("/auth/sign-up?error=not-allowed");
  }

  const { error } = await auth.signUp.email({
    email,
    name: formData.get("name") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect("/auth/sign-up?error=sign-up-failed");
  }

  redirect("/");
}
