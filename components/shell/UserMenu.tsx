"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const { data } = await createSupabaseBrowserClient().auth.getUser();
        if (active) setEmail(data.user?.email ?? null);
      } catch {
        // Leave the account label generic. The sign-out action still works.
      }
    }

    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) {
        console.error("[auth] sign-out failed", error.message);
        setFailed(true);
        setPending(false);
        return;
      }
      // A full navigation drops cached desk pages and the in-memory session.
      window.location.replace("/login");
    } catch (error) {
      console.error("[auth] sign-out failed", error);
      setFailed(true);
      setPending(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={failed ? "Sign-out failed. Try again." : "Sign out"}
        title={failed ? "Sign-out failed. Try again." : "Sign out"}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
          failed ? "text-short" : "text-muted hover:text-short"
        }`}
        disabled={pending}
        onClick={signOut}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} strokeWidth={1.7} />}
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2 px-1 text-faint">
        <UserRound size={12} strokeWidth={1.7} aria-hidden="true" />
        <span className="truncate font-mono text-[8.5px] tracking-[0.08em]" aria-live="polite">
          {failed ? "SIGN-OUT FAILED" : email ?? "SIGNED IN"}
        </span>
      </div>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1.5 px-1 text-[11px] text-muted transition-colors hover:text-short"
        disabled={pending}
        onClick={signOut}
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
        Sign out
      </button>
    </div>
  );
}
