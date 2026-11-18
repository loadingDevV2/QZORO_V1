"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
}

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter the email and password for your QZORO account." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        return { error: "This account is not confirmed yet. Ask the desk owner to confirm it in Supabase." };
      }
      if (/invalid login credentials/i.test(error.message)) {
        return { error: "That email and password do not match." };
      }
      return { error: "Sign-in failed. Ask the desk owner to check the account." };
    }
  } catch (error) {
    console.error("[auth] sign-in failed", error);
    return { error: "The desk is not connected to Supabase yet. Check the deployment environment." };
  }

  redirect(safeNextPath(formData.get("next")));
}
