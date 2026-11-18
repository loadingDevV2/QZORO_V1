"use client";

import { useActionState } from "react";
import { AlertTriangle, ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { signIn, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="field-label">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          className="field !text-[13px]"
          placeholder="trader@example.com"
          required
          disabled={pending}
        />
      </label>

      <label className="block">
        <span className="field-label">Password</span>
        <div className="relative">
          <KeyRound
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className="field !pl-9 !text-[13px]"
            placeholder="Your desk password"
            required
            disabled={pending}
          />
        </div>
      </label>

      {state.error ? (
        <p
          className="flex items-start gap-2 border border-[rgba(255,116,104,0.32)] bg-[rgba(255,116,104,0.055)] px-3 py-2.5 text-[11px] leading-relaxed text-short"
          aria-live="polite"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
        {pending ? "Opening the desk…" : "Enter the desk"}
      </button>
    </form>
  );
}
