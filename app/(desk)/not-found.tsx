import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = {
  title: "Not on file",
};

export default function DeskNotFound() {
  return (
    <>
      <PageHeader
        title="Not on file"
        description="That ticket, entry, or page is not part of this desk."
        actions={
          <Link href="/" className="btn btn-ghost">
            <ArrowLeft size={15} strokeWidth={1.8} />
            Back to the desk
          </Link>
        }
      />

      <section className="panel flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-ink-2 text-faint">
          <FileQuestion size={19} strokeWidth={1.6} aria-hidden="true" />
        </div>
        <p className="mt-5 font-mono text-[9px] tracking-[0.2em] text-faint">QZ-404</p>
        <h2 className="mt-2 text-[24px] tracking-[-0.03em] text-bone">Nothing under that number.</h2>
        <p className="mt-2 max-w-[48ch] text-[12px] leading-relaxed text-muted">
          The record may have been cleared, or the link may belong to another account. The desk never
          exposes a review or trade that is not yours.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/journal" className="btn btn-quiet btn-sm">
            Open the ledger
          </Link>
          <Link href="/analyze" className="btn btn-primary btn-sm">
            Review a chart
          </Link>
        </div>
      </section>
    </>
  );
}
