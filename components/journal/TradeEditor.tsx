"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { fmtLots, fmtPrice } from "@/lib/format";
import type { Trade, TradeResult } from "@/lib/types";

const OUTCOMES: { value: Exclude<TradeResult, "open">; label: string }[] = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "breakeven", label: "Breakeven" },
];

export function TradeEditor({
  trade,
  onCancel,
  onSaved,
}: {
  trade: Trade;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const closing = trade.result === "open";
  const [result, setResult] = useState<Exclude<TradeResult, "open"> | "">(
    trade.result === "open" ? "" : trade.result,
  );
  const [exitPrice, setExitPrice] = useState(trade.exitPrice == null ? "" : String(trade.exitPrice));
  const [tradeDate, setTradeDate] = useState(trade.tradeDate);
  const [setup, setSetup] = useState(trade.setup);
  const [notes, setNotes] = useState(trade.notes);
  const [followedPlan, setFollowedPlan] = useState(trade.followedPlan);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exitHint =
    result === "win"
      ? `Defaults to target ${fmtPrice(trade.takeProfit)}`
      : result === "loss"
        ? `Defaults to stop ${fmtPrice(trade.stopLoss)}`
        : result === "breakeven"
          ? `Defaults to entry ${fmtPrice(trade.entry)}`
          : "Choose an outcome first";

  async function save() {
    if (!result || pending) return;
    setPending(true);
    setError(null);

    const exitNumber = exitPrice.trim() === "" ? null : Number(exitPrice);
    if (exitNumber != null && (!Number.isFinite(exitNumber) || exitNumber <= 0)) {
      setError("Exit price must be a positive number, or left blank.");
      setPending(false);
      return;
    }

    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tradeDate,
          setup,
          result,
          exitPrice: exitNumber,
          notes,
          followedPlan,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "The entry could not be updated.");
        return;
      }
      onSaved(closing ? "Trade closed and priced. The R curve has moved." : "Ledger entry updated.");
    } catch {
      setError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-line bg-panel-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] tracking-[0.16em] text-accent">{closing ? "CLOSE" : "EDIT"}</span>
            <span className="text-[13px] text-bone">{closing ? "Close this trade" : "Edit this entry"}</span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-faint">
            {trade.direction.toUpperCase()} {fmtPrice(trade.entry)} · stop {fmtPrice(trade.stopLoss)} · target{" "}
            {fmtPrice(trade.takeProfit)} · {fmtLots(trade.lots)} lots
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel} disabled={pending}>
            <X size={12} />
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!result || pending}>
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {pending ? "Saving…" : closing ? "Close trade" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="field-label">Date</span>
          <input
            type="date"
            className="field !text-[12px]"
            value={tradeDate}
            onChange={(event) => setTradeDate(event.target.value)}
            disabled={pending}
          />
        </label>
        <label className="block">
          <span className="field-label">Setup</span>
          <input
            type="text"
            className="field field-text"
            maxLength={120}
            value={setup}
            onChange={(event) => setSetup(event.target.value)}
            disabled={pending}
          />
        </label>
        <label className="block">
          <span className="field-label">Outcome</span>
          <select
            className="field field-text"
            value={result}
            onChange={(event) => setResult(event.target.value as Exclude<TradeResult, "open"> | "")}
            disabled={pending}
          >
            <option value="">Choose outcome</option>
            {OUTCOMES.map((outcome) => (
              <option key={outcome.value} value={outcome.value}>
                {outcome.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Exit price</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="field field-text"
            placeholder={exitHint}
            value={exitPrice}
            onChange={(event) => setExitPrice(event.target.value)}
            disabled={pending}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            className="field field-text"
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={pending}
          />
        </label>
        <label className="flex cursor-pointer items-start gap-2 pb-1 lg:max-w-[240px]">
          <input
            type="checkbox"
            className="mt-[2px] accent-[var(--accent)]"
            checked={followedPlan}
            onChange={(event) => setFollowedPlan(event.target.checked)}
            disabled={pending}
          />
          <span className="text-[10.5px] leading-relaxed text-muted">The plan was followed.</span>
        </label>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-faint">
        {closing
          ? `Blank exit uses the ${result === "win" ? "target" : result === "loss" ? "stop" : result === "breakeven" ? "entry" : "outcome default"}. P&L and R are recomputed on the server.`
          : "The entry, stop, target, and size stay locked. P&L and R are recomputed from the outcome."}
      </p>

      {error ? (
        <p className="mt-2.5 border border-[rgba(255,116,104,0.34)] bg-[rgba(255,116,104,0.055)] px-3 py-2 text-[11px] leading-relaxed text-short">
          {error}
        </p>
      ) : null}
    </div>
  );
}
