import { Suspense } from "react";
import { connection } from "next/server";
import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { JournalLedger } from "@/components/journal/JournalLedger";
import { listTrades, readSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deskDateKey } from "@/lib/desk-time";
import { computeGuardrails } from "@/lib/risk";
import { computeStats } from "@/lib/stats";

export const metadata = {
  title: "The ledger",
};

export default function JournalPage() {
  return (
    <>
      <PageHeader
        title="The ledger"
        description="The journal is the source of truth. Every entry is priced by the desk, and every close moves the R curve and the day's limits."
        actions={
          <>
            <a href="/api/export" download className="btn btn-ghost hidden sm:inline-flex">
              <Download size={15} strokeWidth={1.8} />
              Export CSV
            </a>
            <a href="#new-entry" className="btn btn-primary">
              <Plus size={15} strokeWidth={1.8} />
              Log a trade
            </a>
          </>
        }
      />

      <Suspense fallback={<LedgerFallback />}>
        <LedgerData />
      </Suspense>
    </>
  );
}

async function LedgerData() {
  await connection();

  const user = await requireUser();
  const [settings, trades] = await Promise.all([readSettings(user.id), listTrades(user.id)]);
  const stats = computeStats(trades, settings);
  const guardrails = computeGuardrails(trades, settings);
  const today = deskDateKey();

  return (
    <JournalLedger
      trades={trades}
      stats={stats}
      guardrails={guardrails}
      account={settings.account}
      instrument={settings.instrument}
      today={today}
    />
  );
}

function LedgerFallback() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="panel skeleton h-[190px]" />
      <div className="grid grid-cols-1 gap-5 min-[1700px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="panel skeleton h-[520px]" />
        <div className="panel skeleton h-[620px]" />
      </div>
    </div>
  );
}
