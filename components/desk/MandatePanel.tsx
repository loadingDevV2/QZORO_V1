import Link from "next/link";
import { fmtDate, fmtR, fmtSignedUsd, fmtUsd } from "@/lib/format";
import type { Guardrails } from "@/lib/types";

function StatusCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "long" | "short" | "warn" | "bone";
  hint?: string;
}) {
  const color =
    tone === "long"
      ? "text-long"
      : tone === "short"
        ? "text-short"
        : tone === "warn"
          ? "text-warn"
          : "text-bone";
  return (
    <div className="bg-panel px-5 py-4">
      <div className="label">{label}</div>
      <div className={`num mt-2 text-[19px] leading-none ${color}`}>{value}</div>
      {hint ? <div className="mt-1.5 text-[11px] text-faint">{hint}</div> : null}
    </div>
  );
}

export function MandatePanel({ guardrails }: { guardrails: Guardrails }) {
  const statusWord =
    guardrails.status === "clear" ? "CLEAR" : guardrails.status === "caution" ? "CAUTION" : "LOCKED";
  const dot =
    guardrails.status === "clear" ? "bg-long" : guardrails.status === "caution" ? "bg-warn" : "bg-short";
  const wordColor =
    guardrails.status === "clear"
      ? "text-long"
      : guardrails.status === "caution"
        ? "text-warn"
        : "text-short";
  const statusLine =
    guardrails.status === "clear"
      ? "Every limit is intact. Trade the plan, not the mood."
      : guardrails.status === "caution"
        ? "Still open, but the margin is thinner. Half-size is a decision too."
        : "The desk is closed for today. No new risk.";

  const used = Math.max(0, -guardrails.realizedTodayUsd);
  const usedPct = guardrails.dailyLossLimitUsd > 0 ? Math.min(100, (used / guardrails.dailyLossLimitUsd) * 100) : 0;
  const budgetTone = usedPct > 75 ? "var(--short)" : "var(--warn)";

  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_1.1fr_1.3fr]">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <span className="label">Today&apos;s mandate</span>
            <span className="num text-[10.5px] text-faint">{fmtDate(guardrails.asOf)}</span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className={`h-2 w-2 ${dot}`} aria-hidden="true" />
            <h2 className={`text-[32px] leading-none tracking-[-0.04em] ${wordColor}`}>{statusWord}</h2>
          </div>
          <p className="mt-2.5 max-w-[38ch] text-[12.5px] leading-relaxed text-muted">{statusLine}</p>

          {guardrails.reasons.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {guardrails.reasons.slice(0, 3).map((reason) => (
                <li key={reason} className="flex gap-2 text-[11.5px] leading-relaxed text-faint">
                  <span className="mt-[7px] h-1 w-1 shrink-0 bg-current" aria-hidden="true" />
                  {reason}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-[11.5px] text-faint">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6.2 4.8 9 10 3.4" stroke="var(--long)" strokeWidth="1.3" />
              </svg>
              No breaches today.
            </div>
          )}
        </div>

        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label">Daily loss budget</span>
            <span className="num text-[10.5px] text-faint">{usedPct.toFixed(0)}% used</span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <div className="num text-[26px] leading-none text-bone">{fmtUsd(guardrails.dailyRemainingUsd)}</div>
              <div className="mt-1.5 text-[11px] text-faint">
                left of {fmtUsd(guardrails.dailyLossLimitUsd)} · {fmtUsd(guardrails.balance)} account
              </div>
            </div>
          </div>

          <div className="mt-4 bar-track">
            <div
              className="bar-fill"
              style={{
                transform: `scaleX(${Math.min(100, Math.max(0, usedPct)) / 100})`,
                background: budgetTone,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
            <span>USED {fmtUsd(used)}</span>
            <span>WEEK {fmtSignedUsd(guardrails.weeklyRealizedUsd)}</span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-[11.5px] text-faint">Risk per trade</span>
            <span className="num text-[12px] text-muted">{fmtUsd(guardrails.riskPerTradeUsd)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-faint">Weekly stop</span>
            <span className="num text-[12px] text-muted">
              {fmtSignedUsd(guardrails.weeklyRealizedUsd)} / −{fmtUsd(guardrails.weeklyLossLimitUsd)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-line">
          <StatusCell
            label="Realized today"
            value={fmtSignedUsd(guardrails.realizedTodayUsd)}
            tone={guardrails.realizedTodayUsd > 0 ? "long" : guardrails.realizedTodayUsd < 0 ? "short" : "bone"}
            hint={`${fmtR(guardrails.realizedTodayR)} on the day`}
          />
          <StatusCell
            label="Trades today"
            value={`${guardrails.tradesToday} / ${guardrails.maxTradesPerDay}`}
            hint={`${guardrails.tradesRemaining} left in the cap`}
          />
          <StatusCell
            label="Open risk"
            value={fmtUsd(guardrails.openRiskUsd)}
            tone={guardrails.openRiskUsd > 0 ? "warn" : "bone"}
            hint={`${guardrails.openTrades} open position${guardrails.openTrades === 1 ? "" : "s"}`}
          />
          <StatusCell
            label="Loss streak"
            value={`${guardrails.lossStreak}`}
            tone={guardrails.lossStreak > 0 ? "short" : "bone"}
            hint={`Desk stops at ${guardrails.maxConsecutiveLosses}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3">
        <p className="text-[11px] text-faint">
          Daily cap halts new risk. It never closes a position for you.
        </p>
        <Link href="/journal" className="link-underline font-mono text-[10px] tracking-[0.12em] text-muted">
          OPEN THE LEDGER →
        </Link>
      </div>
    </section>
  );
}
