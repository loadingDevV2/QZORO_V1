"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Loader2, Plus } from "lucide-react";
import { buildTrade, type TradeDraft } from "@/lib/trade-service";
import { fmtLots, fmtPct, fmtR, fmtSignedUsd, fmtUsd } from "@/lib/format";
import type { AccountRules, InstrumentSpec, TradeResult } from "@/lib/types";

const RESULT_OPTIONS: { value: TradeResult; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "breakeven", label: "Breakeven" },
];

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TradeEntryForm({
  account,
  instrument,
  today,
  onCreated,
}: {
  account: AccountRules;
  instrument: InstrumentSpec;
  today: string;
  onCreated: () => void;
}) {
  const [tradeDate, setTradeDate] = useState(today);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [setup, setSetup] = useState("");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [lots, setLots] = useState("");
  const [result, setResult] = useState<TradeResult>("open");
  const [exitPrice, setExitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [followedPlan, setFollowedPlan] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview = useMemo(() => {
    const entryNumber = numberOrNull(entry);
    const stopNumber = numberOrNull(stopLoss);
    const targetNumber = numberOrNull(takeProfit);
    if (entryNumber == null || stopNumber == null || targetNumber == null) return null;

    const draft: TradeDraft = {
      tradeDate,
      direction,
      setup,
      entry: entryNumber,
      stopLoss: stopNumber,
      takeProfit: targetNumber,
      lots: numberOrNull(lots) ?? 0,
      result,
      exitPrice: result === "open" ? null : numberOrNull(exitPrice),
      notes,
      followedPlan,
      analysisId: null,
      source: "manual",
    };

    return buildTrade(draft, { account, instrument });
  }, [
    tradeDate,
    direction,
    setup,
    entry,
    stopLoss,
    takeProfit,
    lots,
    result,
    exitPrice,
    notes,
    followedPlan,
    account,
    instrument,
  ]);

  const trade = preview?.ok ? preview.trade : null;
  const canSubmit = Boolean(trade) && !pending;

  async function submit() {
    if (!trade || pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tradeDate,
          direction,
          setup,
          entry: numberOrNull(entry),
          stopLoss: numberOrNull(stopLoss),
          takeProfit: numberOrNull(takeProfit),
          lots: numberOrNull(lots) ?? 0,
          result,
          exitPrice: result === "open" ? null : numberOrNull(exitPrice),
          notes,
          followedPlan,
          source: "manual",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "The trade could not be logged.");
        return;
      }

      setSetup("");
      setEntry("");
      setStopLoss("");
      setTakeProfit("");
      setLots("");
      setResult("open");
      setExitPrice("");
      setNotes("");
      setFollowedPlan(true);
      setSuccess("Entry logged. The ledger and the day's limits are updated.");
      onCreated();
      window.setTimeout(() => setSuccess(null), 5000);
    } catch {
      setError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="new-entry" className="panel overflow-hidden scroll-mt-6">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] tracking-[0.16em] text-accent">+</span>
            <h2 className="text-[16px] text-bone">New entry</h2>
          </div>
          <p className="mt-1 text-[11.5px] text-faint">The desk sizes it. You record what you take.</p>
        </div>
        <span className="font-mono text-[9px] tracking-[0.12em] text-faint">{instrument.symbol}</span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <span className="field-label">Side</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(["long", "short"] as const).map((side) => (
              <button
                key={side}
                type="button"
                className="chip justify-center !rounded-[7px]"
                data-active={direction === side}
                aria-pressed={direction === side}
                onClick={() => setDirection(side)}
              >
                {side === "long" ? "LONG" : "SHORT"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
          <label className="block">
            <span className="field-label">Date</span>
            <input
              type="date"
              className="field !text-[12px]"
              value={tradeDate}
              onChange={(event) => setTradeDate(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Setup</span>
            <input
              type="text"
              className="field field-text"
              maxLength={120}
              placeholder="Retest of range high"
              value={setup}
              onChange={(event) => setSetup(event.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="field-label">Entry</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="field !px-2 !text-[12px]"
              placeholder="4181.50"
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Stop</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="field !px-2 !text-[12px]"
              placeholder="4172.80"
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Target</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="field !px-2 !text-[12px]"
              placeholder="4203.00"
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Lots (optional)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max="100"
              className="field field-text"
              placeholder="Desk size"
              value={lots}
              onChange={(event) => setLots(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Result</span>
            <select
              className="field field-text"
              value={result}
              onChange={(event) => setResult(event.target.value as TradeResult)}
            >
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {result !== "open" ? (
          <label className="block">
            <span className="field-label">Exit price (optional)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="field field-text"
              placeholder={
                result === "win"
                  ? `Defaults to target ${takeProfit || "—"}`
                  : result === "loss"
                    ? `Defaults to stop ${stopLoss || "—"}`
                    : `Defaults to entry ${entry || "—"}`
              }
              value={exitPrice}
              onChange={(event) => setExitPrice(event.target.value)}
            />
          </label>
        ) : null}

        <div className="border border-line bg-panel-2 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="label">Desk preview</span>
            <span className="font-mono text-[8.5px] tracking-[0.1em] text-faint">SERVER WILL RECOMPUTE</span>
          </div>

          {trade ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <div className="label">Size</div>
                  <div className="num mt-1 text-[15px] text-bone">{fmtLots(trade.lots)}</div>
                  <div className="mt-0.5 text-[9px] text-faint">lots</div>
                </div>
                <div>
                  <div className="label">Risk</div>
                  <div className="num mt-1 text-[15px] text-short">−{fmtUsd(trade.riskUsd)}</div>
                  <div className="mt-0.5 text-[9px] text-faint">{fmtPct(trade.riskPct, 2)}</div>
                </div>
                <div>
                  <div className="label">Planned R</div>
                  <div className="num mt-1 text-[15px] text-long">{fmtR(trade.plannedRr)}</div>
                  <div className="mt-0.5 text-[9px] text-faint">after costs</div>
                </div>
              </div>
              {trade.pnlUsd != null ? (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-[10.5px] text-faint">
                    This close: {fmtSignedUsd(trade.pnlUsd)} / {fmtR(trade.rMultiple)}
                  </span>
                  <span className="font-mono text-[8.5px] tracking-[0.08em] text-faint">
                    {result.toUpperCase()}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              {entry && stopLoss && takeProfit
                ? preview?.error ?? "The desk could not price this entry."
                : "Enter an entry, stop, and target to see the desk size and R."}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-[2px] accent-[var(--accent)]"
            checked={followedPlan}
            onChange={(event) => setFollowedPlan(event.target.checked)}
          />
          <span className="text-[11px] leading-relaxed text-muted">
            I followed the plan: entry, stop, and target as written.
          </span>
        </label>

        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            className="field field-text"
            rows={2}
            maxLength={2000}
            placeholder="Why you took it, or why you closed early."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {error ? (
          <p className="border border-[rgba(255,116,104,0.34)] bg-[rgba(255,116,104,0.055)] px-3 py-2.5 text-[11px] leading-relaxed text-short">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-long" aria-live="polite">
            <Check size={13} className="mt-0.5 shrink-0" />
            {success}
          </p>
        ) : null}

        <button type="button" className="btn btn-primary w-full" disabled={!canSubmit} onClick={submit}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {pending ? "Logging…" : "Log trade"}
        </button>

        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-faint">
          <ArrowUpRight size={11} className="mt-0.5 shrink-0" />
          The journal records reality, including trades that broke the rules. The discipline score
          will reflect it.
        </p>
      </div>
    </section>
  );
}
