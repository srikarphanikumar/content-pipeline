"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signInWithEmail(formData: FormData) {
  const { error } = await auth.signIn.email({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect("/auth/sign-in?error=invalid-credentials");
  }

  redirect("/");
}
