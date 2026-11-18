"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

export default function DeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[desk] page failed", error);
  }, [error]);

  return (
    <>
      <PageHeader
        title="The desk hit a snag"
        description="The page could not load its records. Your journal has not been changed."
      />

      <section className="panel flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[rgba(255,116,104,0.35)] bg-[rgba(255,116,104,0.06)] text-short">
          <AlertTriangle size={19} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <p className="mt-5 font-mono text-[9px] tracking-[0.2em] text-faint">QZ-LOAD-ERROR</p>
        <h2 className="mt-2 text-[24px] tracking-[-0.03em] text-bone">Nothing was lost.</h2>
        <p className="mt-2 max-w-[48ch] text-[12px] leading-relaxed text-muted">
          Refresh the page to try again. If this keeps happening, contact the desk owner.
        </p>
        <button type="button" className="btn btn-primary btn-sm mt-6" onClick={reset}>
          <RotateCcw size={13} />
          Try again
        </button>
      </section>
    </>
  );
}
