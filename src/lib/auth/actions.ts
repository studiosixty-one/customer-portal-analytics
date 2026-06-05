"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return "Invalid email or password.";
      }
      return "Something went wrong. Please try again.";
    }
    // Re-throw redirect (and any other) errors so Next.js can handle them.
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
