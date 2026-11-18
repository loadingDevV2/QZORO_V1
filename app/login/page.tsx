import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { BarChart3, LockKeyhole, ShieldCheck } from "lucide-react";
import { safeNextPath } from "@/lib/auth-paths";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="relative flex min-h-dvh items-start justify-center px-4 py-8 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(185,243,109,0.105),transparent_34%),radial-gradient(circle_at_82%_84%,rgba(95,211,155,0.06),transparent_38%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(226,242,226,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(226,242,226,0.08)_1px,transparent_1px)] [background-size:52px_52px]"
      />

      <div className="relative my-auto grid w-full max-w-[1000px] overflow-hidden rounded-[18px] border border-line-strong bg-panel shadow-[0_30px_90px_rgba(0,0,0,0.5)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-ink-2 p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/qzoro-mark.png"
                alt=""
                width={48}
                height={48}
                priority
                className="rounded-[8px] border border-[rgba(185,243,109,0.28)]"
              />
              <div>
                <div className="text-[18px] font-semibold leading-none tracking-[0.18em] text-bone">QZORO</div>
                <div className="mt-2 font-mono text-[8.5px] leading-none tracking-[0.28em] text-faint">
                  XAUUSD RISK DESK
                </div>
              </div>
            </div>

            <div className="mt-16 max-w-[42ch]">
              <span className="label text-accent">Private access</span>
              <p className="mt-4 text-[clamp(34px,4vw,48px)] leading-[1.02] tracking-[-0.045em] text-bone">
                One chart.
                <br />
                One plan.
                <br />
                One honest record.
              </p>
              <p className="mt-5 text-[13px] leading-relaxed text-muted">
                The desk reads the structure, prices the risk, and refuses the trade when the numbers do
                not survive. Your journal stays in your account, not in a browser tab.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px border border-line bg-line">
            <div className="bg-panel px-4 py-4">
              <BarChart3 size={15} className="text-accent" aria-hidden="true" />
              <p className="mt-3 font-mono text-[8.5px] tracking-[0.14em] text-faint">CHART READ</p>
              <p className="mt-1 text-[11.5px] text-bone">Structured levels</p>
            </div>
            <div className="bg-panel px-4 py-4">
              <ShieldCheck size={15} className="text-long" aria-hidden="true" />
              <p className="mt-3 font-mono text-[8.5px] tracking-[0.14em] text-faint">MANDATE</p>
              <p className="mt-1 text-[11.5px] text-bone">Daily limits</p>
            </div>
            <div className="bg-panel px-4 py-4">
              <LockKeyhole size={15} className="text-warn" aria-hidden="true" />
              <p className="mt-3 font-mono text-[8.5px] tracking-[0.14em] text-faint">PRIVATE</p>
              <p className="mt-1 text-[11.5px] text-bone">Per-account data</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/qzoro-mark.png"
              alt=""
              width={36}
              height={36}
              priority
              className="rounded-[6px] border border-[rgba(185,243,109,0.28)]"
            />
            <div>
              <div className="text-[15px] font-semibold leading-none tracking-[0.18em] text-bone">QZORO</div>
              <div className="mt-1.5 font-mono text-[8px] leading-none tracking-[0.24em] text-faint">
                XAUUSD RISK DESK
              </div>
            </div>
          </div>

          <div>
            <span className="label">Account access</span>
            <h1 className="mt-3 text-[30px] leading-none tracking-[-0.035em] text-bone">Sign in</h1>
            <p className="mt-3 max-w-[42ch] text-[12px] leading-relaxed text-faint">
              Accounts are created by the desk owner in Supabase. There is no public sign-up.
            </p>
          </div>

          <Suspense fallback={<LoginFormFallback />}>
            <LoginParams searchParams={searchParams} />
          </Suspense>

          <p className="mt-8 border-t border-line pt-4 text-[10px] leading-relaxed text-faint">
            QZORO is an analysis and record-keeping tool, not financial advice. Verify every level on your
            own chart.
          </p>
        </section>
      </div>
    </main>
  );
}

async function LoginParams({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <LoginForm next={safeNextPath(next)} />;
}

function LoginFormFallback() {
  return (
    <div className="mt-7 space-y-4" aria-hidden="true">
      <div className="skeleton h-[62px] rounded-lg" />
      <div className="skeleton h-[62px] rounded-lg" />
      <div className="skeleton h-[38px] rounded-lg" />
    </div>
  );
}
