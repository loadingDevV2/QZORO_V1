import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { counts, readSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toClientSettings } from "@/lib/settings-service";

export const metadata = {
  title: "Desk settings",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Desk settings"
        description="The rulebook behind every ticket: the reading provider, the account mandate, and the cost model. Change it here, deliberately."
        actions={
          <Link href="/journal" className="btn btn-ghost">
            <BookOpen size={15} strokeWidth={1.8} />
            Open the ledger
          </Link>
        }
      />

      <Suspense fallback={<SettingsFallback />}>
        <SettingsData />
      </Suspense>
    </>
  );
}

async function SettingsData() {
  await connection();

  const user = await requireUser();
  const [settings, journalCounts] = await Promise.all([readSettings(user.id), counts(user.id)]);

  return <SettingsForm settings={toClientSettings(settings)} counts={journalCounts} />;
}

function SettingsFallback() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="panel skeleton h-[64px]" />
      <div className="panel skeleton h-[500px]" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="panel skeleton h-[560px]" />
        <div className="panel skeleton h-[560px]" />
      </div>
    </div>
  );
}
