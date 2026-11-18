import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { AnalyzeWorkbench } from "@/components/analyze/AnalyzeWorkbench";
import { listTrades, readSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deskDateKey } from "@/lib/desk-time";
import { computeGuardrails } from "@/lib/risk";
import { activeKeyStatus } from "@/lib/settings-service";

export const metadata = {
  title: "Chart review",
};

export default function AnalyzePage() {
  return (
    <>
      <PageHeader
        title="Chart review"
        description="One screenshot, one objective read. The desk maps the structure, names the invalidation, and sizes the only plan that survives its own rules."
        actions={
          <Link href="/settings" className="btn btn-ghost">
            <Settings2 size={15} strokeWidth={1.8} />
            Provider settings
          </Link>
        }
      />

      <Suspense fallback={<ReviewFallback />}>
        <ReviewData />
      </Suspense>
    </>
  );
}

async function ReviewData() {
  await connection();

  const user = await requireUser();
  const [settings, trades] = await Promise.all([readSettings(user.id), listTrades(user.id)]);
  const guardrails = computeGuardrails(trades, settings);
  const keyStatus = activeKeyStatus(settings);

  return (
    <AnalyzeWorkbench
      provider={settings.provider}
      model={settings.models[settings.provider]}
      keyReady={keyStatus.ready}
      keySource={keyStatus.source}
      account={settings.account}
      instrument={settings.instrument}
      guardrails={guardrails}
      today={deskDateKey()}
    />
  );
}

function ReviewFallback() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" aria-hidden="true">
      <div className="panel skeleton h-[620px]" />
      <div className="space-y-5">
        <div className="panel skeleton h-[220px]" />
        <div className="panel skeleton h-[190px]" />
        <div className="panel skeleton h-[230px]" />
      </div>
    </div>
  );
}
