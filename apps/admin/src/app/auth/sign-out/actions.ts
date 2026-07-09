"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signOut() {
  await auth.signOut();
  redirect("/auth/sign-in");
}
