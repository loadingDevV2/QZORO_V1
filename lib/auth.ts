import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { safeNextPath } from "./auth-paths";
import { hasSupabaseConfig } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface ApiSession {
  supabase: SupabaseClient;
  user: SessionUser;
}

function narrowUser(user: User): SessionUser {
  return { id: user.id, email: user.email ?? null };
}

async function readSession(): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const { user } = await readSession();
  return user ? narrowUser(user) : null;
}

/** Use in pages. The proxy handles the optimistic redirect; this is the guard. */
export async function requireUser(nextPath = "/"): Promise<SessionUser> {
  if (!hasSupabaseConfig()) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }
  return user;
}

/** Use in route handlers and server actions that return data directly. */
export async function requireApiSession(): Promise<ApiSession | null> {
  // Treat an unconfigured deployment as unauthenticated instead of throwing a
  // 500 from the Supabase client constructor.
  if (!hasSupabaseConfig()) return null;
  const { supabase, user } = await readSession();
  if (!user) return null;
  return { supabase, user: narrowUser(user) };
}

export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "Sign in to use the desk.", code: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}
