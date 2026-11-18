import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { AnalysisTicket } from "@/components/analyze/AnalysisTicket";
import { getAnalysis, hasTradeForAnalysis } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DISCLAIMER, PROVIDER_LABEL } from "@/lib/constants";
import { deskDateKey } from "@/lib/desk-time";
import { fmtDateTime, fmtUsd } from "@/lib/format";
import type { ProviderId } from "@/lib/types";

export const metadata = {
  title: "Filed review",
};

type ReviewPageProps = { params: Promise<{ id: string }> };

export default function ReviewPage({ params }: ReviewPageProps) {
  return (
    <>
      <PageHeader
        title="Filed review"
        description="The ticket exactly as it was written, with the chart, the levels, and the mandate it was judged against."
        actions={
          <>
            <Link href="/journal" className="btn btn-ghost hidden sm:inline-flex">
              Open the ledger
            </Link>
            <Link href="/analyze" className="btn btn-primary">
              <ScanLine size={15} strokeWidth={1.8} />
              Review a chart
            </Link>
          </>
        }
      />

      <Suspense fallback={<ReviewFallback />}>
        <ReviewDetail params={params} />
      </Suspense>
    </>
  );
}

async function ReviewDetail({ params }: ReviewPageProps) {
  await connection();
  const user = await requireUser();
  const { id } = await params;
  const [analysis, alreadyLogged] = await Promise.all([
    getAnalysis(user.id, id),
    hasTradeForAnalysis(user.id, id),
  ]);
  if (!analysis) notFound();

  const today = deskDateKey();
  const guardrails = analysis.guardrails;
  const mandateTone =
    guardrails.status === "clear"
      ? "text-long"
      : guardrails.status === "caution"
        ? "text-warn"
        : "text-short";
  const providerName = analysis.demo
    ? "Sample desk"
    : PROVIDER_LABEL[analysis.provider as ProviderId] ?? analysis.provider;

  return (
    <div className="space-y-5">
      <section className="panel grid grid-cols-2 gap-px overflow-hidden bg-line md:grid-cols-4">
        <div className="bg-panel px-5 py-4">
          <div className="label">Filed</div>
          <div className="num mt-2 text-[12.5px] text-bone">{fmtDateTime(analysis.createdAt)}</div>
        </div>
        <div className="bg-panel px-5 py-4">
          <div className="label">Read by</div>
          <div className="mt-2 truncate text-[12.5px] text-bone">{providerName}</div>
          <div className="mt-0.5 truncate font-mono text-[9.5px] text-faint">{analysis.model}</div>
        </div>
        <div className="bg-panel px-5 py-4">
          <div className="label">Mandate at filing</div>
          <div className={`num mt-2 text-[12.5px] uppercase ${mandateTone}`}>{guardrails.status}</div>
          <div className="mt-0.5 text-[9.5px] text-faint">
            {guardrails.tradesToday} / {guardrails.maxTradesPerDay} trades that day
          </div>
        </div>
        <div className="bg-panel px-5 py-4">
          <div className="label">Daily budget left</div>
          <div className="num mt-2 text-[12.5px] text-bone">{fmtUsd(guardrails.dailyRemainingUsd)}</div>
          <div className="mt-0.5 text-[9.5px] text-faint">
            {analysis.session || "Session not stated"} · {analysis.timeframe || analysis.raw.timeframe}
          </div>
        </div>
      </section>

      {analysis.notes ? (
        <section className="panel px-5 py-4">
          <div className="label">Trader&apos;s note before the read</div>
          <p className="mt-2 max-w-[90ch] text-[12px] leading-relaxed text-muted">{analysis.notes}</p>
        </section>
      ) : null}

      <AnalysisTicket analysis={analysis} alreadyLogged={alreadyLogged} today={today} />

      <footer className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-[82ch] text-[10.5px] leading-relaxed text-faint">{DISCLAIMER}</p>
        <Link
          href="/analyze"
          className="shrink-0 font-mono text-[9.5px] tracking-[0.13em] text-muted transition-colors hover:text-accent-bright"
        >
          REVIEW ANOTHER CHART →
        </Link>
      </footer>
    </div>
  );
}

function ReviewFallback() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="panel skeleton h-[100px]" />
      <div className="panel skeleton h-[620px]" />
    </div>
  );
}
