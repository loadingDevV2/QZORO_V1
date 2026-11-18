import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Plus, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MandatePanel } from "@/components/desk/MandatePanel";
import { EquityPanel } from "@/components/desk/EquityPanel";
import { OpenRiskPanel } from "@/components/desk/OpenRiskPanel";
import { DailyBars } from "@/components/desk/DailyBars";
import { RecentReviews } from "@/components/desk/RecentReviews";
import { FirstSessionPanel } from "@/components/desk/FirstSessionPanel";
import { DisciplinePanel } from "@/components/desk/DisciplinePanel";
import { counts, listAnalyses, listTrades, readSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeGuardrails } from "@/lib/risk";
import { activeKeyStatus } from "@/lib/settings-service";
import { computeStats } from "@/lib/stats";
import { DISCLAIMER, PROVIDER_LABEL } from "@/lib/constants";

export const metadata = {
  title: { absolute: "The desk — QZORO" },
};

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="The desk"
        description="One chart, one plan, one position size. The desk keeps the day honest when the market does not."
        actions={
          <>
            <Link href="/journal#new-entry" className="btn btn-ghost hidden sm:inline-flex">
              <Plus size={15} strokeWidth={1.8} />
              Log a trade
            </Link>
            <Link href="/analyze" className="btn btn-primary">
              <ScanLine size={15} strokeWidth={1.8} />
              Review a chart
            </Link>
          </>
        }
      />

      <Suspense fallback={<DeskFallback />}>
        <DeskData />
      </Suspense>
    </>
  );
}

async function DeskData() {
  await connection();

  const user = await requireUser();
  const [settings, trades, analyses, journalCounts] = await Promise.all([
    readSettings(user.id),
    listTrades(user.id),
    listAnalyses(user.id, 8),
    counts(user.id),
  ]);
  const stats = computeStats(trades, settings);
  const guardrails = computeGuardrails(trades, settings);
  const keyStatus = activeKeyStatus(settings);
  const openTrades = trades.filter((trade) => trade.result === "open");
  const brandNew = journalCounts.trades === 0 && journalCounts.analyses === 0;

  return (
    <div className="space-y-5">
      <MandatePanel guardrails={guardrails} />

      {brandNew ? (
        <FirstSessionPanel providerReady={keyStatus.ready} providerLabel={PROVIDER_LABEL[settings.provider]} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <EquityPanel stats={stats} />
        </div>
        <div className="xl:col-span-4">
          <OpenRiskPanel trades={openTrades} guardrails={guardrails} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <RecentReviews analyses={analyses} />
        </div>
        <div className="xl:col-span-5">
          <DailyBars daily={stats.daily} />
        </div>
      </div>

      <DisciplinePanel stats={stats} />

      <footer className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-[82ch] text-[10.5px] leading-relaxed text-faint">{DISCLAIMER}</p>
        <Link
          href="/settings"
          className="shrink-0 font-mono text-[9.5px] tracking-[0.13em] text-muted transition-colors hover:text-accent-bright"
        >
          DESK RULES →
        </Link>
      </footer>
    </div>
  );
}

function DeskFallback() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="panel h-[276px] skeleton" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="panel h-[350px] skeleton xl:col-span-8" />
        <div className="panel h-[350px] skeleton xl:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="panel h-[280px] skeleton xl:col-span-7" />
        <div className="panel h-[280px] skeleton xl:col-span-5" />
      </div>
    </div>
  );
}
