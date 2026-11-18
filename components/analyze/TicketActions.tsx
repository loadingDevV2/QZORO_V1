"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Loader2, PenLine, ShieldCheck } from "lucide-react";
import { verdictText } from "@/components/ui/Badges";
import { fmtLots, fmtNumber, fmtPct, fmtPrice, fmtR, fmtUsd } from "@/lib/format";
import type { AnalysisRecord } from "@/lib/types";

function buildPlanText(analysis: AnalysisRecord): string {
  const { raw, riskPlan } = analysis;
  const lines: string[] = [
    "QZORO — TRADE PLAN",
    raw.setupName,
    `${raw.instrument} · ${analysis.timeframe || raw.timeframe} · ${raw.direction.toUpperCase()} · ${raw.entryType}`,
    "",
  ];

  if (raw.entry != null) lines.push(`Entry    ${fmtPrice(raw.entry)}`);
  if (raw.stopLoss != null) lines.push(`Stop     ${fmtPrice(raw.stopLoss)}`);
  if (raw.takeProfit1 != null) {
    lines.push(`TP1      ${fmtPrice(raw.takeProfit1)}${riskPlan?.rr1 != null ? `  (${fmtR(riskPlan.rr1)})` : ""}`);
  }
  if (raw.takeProfit2 != null) {
    lines.push(`TP2      ${fmtPrice(raw.takeProfit2)}${riskPlan?.rr2 != null ? `  (${fmtR(riskPlan.rr2)})` : ""}`);
  }

  if (riskPlan) {
    lines.push(
      "",
      `Size     ${fmtLots(riskPlan.lots)} lots (${fmtNumber(riskPlan.unitsOz, 0)} oz)`,
      `Risk     ${fmtUsd(riskPlan.riskUsd)} (${fmtPct(riskPlan.riskPct, 2)})`,
      riskPlan.profitTp1Usd != null ? `TP1 pays ${fmtUsd(riskPlan.profitTp1Usd)} net` : "",
    );
  }

  lines.push(
    "",
    `Trigger: ${raw.trigger || "—"}`,
    `Invalidation: ${raw.invalidation || "—"}`,
    `Management: ${raw.management || "—"}`,
    "",
    `Confidence: ${raw.confidence}/100`,
    `Verdict: ${verdictText(analysis.verdict)}`,
  );

  if (analysis.verdictReasons.length > 0) {
    lines.push("", ...analysis.verdictReasons.map((reason) => `· ${reason}`));
  }

  lines.push(
    "",
    `Levels read by ${analysis.provider} / ${analysis.model}. Size, R:R, and limits computed by the desk.`,
    "Not financial advice. Verify every level on your own chart.",
  );

  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

export function TicketActions({
  analysis,
  alreadyLogged = false,
  today,
  onLogged,
}: {
  analysis: AnalysisRecord;
  alreadyLogged?: boolean;
  today: string;
  onLogged?: () => void;
}) {
  const { raw, riskPlan } = analysis;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(alreadyLogged);
  const [tradeDate, setTradeDate] = useState(today);
  const [lots, setLots] = useState(riskPlan ? riskPlan.lots.toFixed(2) : "");
  const [followedPlan, setFollowedPlan] = useState(true);

  const hasPlan =
    raw.direction !== "none" &&
    raw.entry != null &&
    raw.stopLoss != null &&
    raw.takeProfit1 != null &&
    riskPlan != null;

  const logBlockedReason = analysis.demo
    ? "Sample ticket. Nothing is logged from the worked example."
    : analysis.id == null
      ? "This review was not filed, so it cannot be attached to a ledger entry."
      : analysis.verdict === "stood-down"
        ? "The desk stood down. A refused trade is not a ledger entry."
        : analysis.verdict === "wait"
          ? "Wait for the trigger. Once the entry activates, log it from the ledger."
          : logged
            ? "This review is already in the ledger."
            : null;

  const canLog = hasPlan && logBlockedReason == null;

  async function copyPlan() {
    setCopyError(false);
    const text = buildPlanText(analysis);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError(true);
    }
  }

  async function logTrade() {
    if (!canLog || analysis.id == null) return;
    const lotsNumber = Number(lots);
    if (!Number.isFinite(lotsNumber) || lotsNumber <= 0) {
      setError("Enter a lot size above zero.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tradeDate,
          direction: raw.direction,
          setup: raw.setupName,
          entry: raw.entry,
          stopLoss: raw.stopLoss,
          takeProfit: raw.takeProfit1,
          lots: lotsNumber,
          result: "open",
          exitPrice: null,
          notes: analysis.notes,
          followedPlan,
          analysisId: analysis.id,
          source: "analysis",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "The trade could not be logged.");
        return;
      }
      setLogged(true);
      setLogOpen(false);
      onLogged?.();
    } catch {
      setError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyPlan}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Plan copied" : "Copy plan"}
        </button>

        {logged ? (
          <Link href="/journal" className="btn btn-ghost btn-sm">
            <ShieldCheck size={13} />
            In the ledger
          </Link>
        ) : canLog ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setError(null);
              setLogOpen((open) => !open);
            }}
          >
            <PenLine size={13} />
            {logOpen ? "Close" : "Log open trade"}
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1.5 font-mono text-[9px] tracking-[0.08em] text-faint"
            title={logBlockedReason ?? undefined}
          >
            {logBlockedReason ?? "Not loggable"}
          </span>
        )}
      </div>

      {copyError ? (
        <p className="mt-2 text-[11px] text-short">
          The clipboard is blocked in this browser. Select the ticket text and copy it manually.
        </p>
      ) : null}

      {logOpen && canLog ? (
        <div className="mt-3 border border-line bg-panel-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="label">Log this plan</span>
            <span className="font-mono text-[9px] tracking-[0.12em] text-faint">OPENS AT ENTRY</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Trade date</span>
              <input
                type="date"
                className="field !text-[12px]"
                value={tradeDate}
                onChange={(event) => setTradeDate(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="field-label">Lots</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                className="field !text-[12px]"
                value={lots}
                onChange={(event) => setLots(event.target.value)}
              />
            </label>
          </div>

          <p className="mt-2.5 text-[10.5px] leading-relaxed text-faint">
            Desk size is {riskPlan ? `${fmtLots(riskPlan.lots)} lots` : "—"}. If you take a different
            size, record it here so the R maths stays honest.
          </p>

          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-[2px] accent-[var(--accent)]"
              checked={followedPlan}
              onChange={(event) => setFollowedPlan(event.target.checked)}
            />
            <span className="text-[11px] leading-relaxed text-muted">
              I followed the desk plan: the trigger, the stop, and the target.
            </span>
          </label>

          {error ? <p className="mt-3 text-[11px] text-short">{error}</p> : null}

          <div className="mt-3 flex items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={logTrade}>
              {pending ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
              {pending ? "Logging…" : "Confirm open trade"}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              disabled={pending}
              onClick={() => setLogOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {logged ? (
        <p className="mt-2 text-[11px] text-long" aria-live="polite">
          Logged as an open trade. Close it in the ledger when the outcome is known.
        </p>
      ) : null}
    </div>
  );
}
