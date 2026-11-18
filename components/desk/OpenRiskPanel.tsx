import Link from "next/link";
import { fmtLots, fmtPrice, fmtUsd } from "@/lib/format";
import type { Guardrails, Trade } from "@/lib/types";
import { DirectionTag } from "../ui/Badges";

export function OpenRiskPanel({ trades, guardrails }: { trades: Trade[]; guardrails: Guardrails }) {
  return (
    <section className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] text-bone">Open risk</h2>
          <p className="mt-1 text-[11.5px] text-faint">Risk that is still live in the market.</p>
        </div>
        <div className="text-right">
          <div className="num text-[16px] text-warn">{fmtUsd(guardrails.openRiskUsd)}</div>
          <div className="label mt-1">at risk</div>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center px-5 py-7">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-long" aria-hidden="true" />
            <span className="num text-[13px] text-bone">FLAT</span>
          </div>
          <p className="mt-2 max-w-[34ch] text-[12px] leading-relaxed text-faint">
            Nothing is exposed right now. Keep it that way until the chart pays for the risk.
          </p>
          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-faint">Next trade budget</span>
              <span className="num text-muted">{fmtUsd(guardrails.riskPerTradeUsd)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
              <span className="text-faint">Trades left today</span>
              <span className="num text-muted">
                {guardrails.tradesRemaining} of {guardrails.maxTradesPerDay}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-2 text-[10px] uppercase tracking-[0.12em] text-faint">
            <span>Position</span>
            <span className="text-right">Live risk</span>
          </div>
          <div className="divide-y divide-line border-t border-line">
            {trades.map((trade) => (
              <div key={trade.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DirectionTag direction={trade.direction} />
                    <span className="num text-[11.5px] text-muted">{fmtPrice(trade.entry)}</span>
                  </div>
                  <p className="mt-1.5 truncate text-[11.5px] text-faint">
                    {trade.setup || "Manual entry"} · {fmtLots(trade.lots)} lots
                  </p>
                </div>
                <div className="text-right">
                  <div className="num text-[12.5px] text-short">−{fmtUsd(trade.riskUsd)}</div>
                  <div className="num mt-1 text-[10px] text-faint">at stop</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-[11px] text-faint">Open risk counts against the daily stop.</span>
            <Link href="/journal" className="link-underline font-mono text-[10px] tracking-[0.1em] text-accent">
              LEDGER →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
