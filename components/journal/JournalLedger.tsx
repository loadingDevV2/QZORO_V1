"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  Loader2,
  Trash2,
} from "lucide-react";
import { ResultTag } from "@/components/ui/Badges";
import { TradeEntryForm } from "@/components/journal/TradeEntryForm";
import { TradeEditor } from "@/components/journal/TradeEditor";
import {
  fmtDate,
  fmtLots,
  fmtNumber,
  fmtPrice,
  fmtR,
  fmtSignedUsd,
  fmtUsd,
} from "@/lib/format";
import type { AccountRules, Guardrails, InstrumentSpec, Stats, Trade } from "@/lib/types";

type Filter = "all" | "open" | "closed" | "wins" | "losses";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "wins", label: "Wins" },
  { value: "losses", label: "Losses" },
];

function pnlTone(value: number | null): string {
  if (value == null) return "text-faint";
  if (value > 0) return "text-long";
  if (value < 0) return "text-short";
  return "text-muted";
}

function rTone(value: number | null): string {
  if (value == null) return "text-faint";
  if (value > 0) return "text-long";
  if (value < 0) return "text-short";
  return "text-muted";
}

function StatCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="bg-panel px-5 py-4">
      <div className="label">{label}</div>
      <div className={`num mt-2 text-[19px] leading-none ${tone ?? "text-bone"}`}>{value}</div>
      <div className="mt-1.5 text-[10px] text-faint">{hint}</div>
    </div>
  );
}

export function JournalLedger({
  trades,
  stats,
  guardrails,
  account,
  instrument,
  today,
}: {
  trades: Trade[];
  stats: Stats;
  guardrails: Guardrails;
  account: AccountRules;
  instrument: InstrumentSpec;
  today: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function announce(message: string) {
    setFlash(message);
    setError(null);
    window.setTimeout(() => setFlash(null), 5000);
  }

  const ordered = useMemo(() => {
    return [...trades].sort((a, b) => {
      if (a.result === "open" && b.result !== "open") return -1;
      if (b.result === "open" && a.result !== "open") return 1;
      return (b.tradeDate + b.createdAt).localeCompare(a.tradeDate + a.createdAt);
    });
  }, [trades]);

  const filtered = useMemo(() => {
    if (filter === "open") return ordered.filter((trade) => trade.result === "open");
    if (filter === "closed") return ordered.filter((trade) => trade.result !== "open");
    if (filter === "wins") return ordered.filter((trade) => trade.result === "win");
    if (filter === "losses") return ordered.filter((trade) => trade.result === "loss");
    return ordered;
  }, [ordered, filter]);

  const mandateDot =
    guardrails.status === "clear" ? "bg-long" : guardrails.status === "caution" ? "bg-warn" : "bg-short";
  const mandateTone =
    guardrails.status === "clear"
      ? "text-long"
      : guardrails.status === "caution"
        ? "text-warn"
        : "text-short";
  const mandateWord =
    guardrails.status === "clear" ? "CLEAR" : guardrails.status === "caution" ? "CAUTION" : "LOCKED";

  async function deleteEntry(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "That entry could not be deleted.");
        return;
      }
      setDeleteId(null);
      setEditingId(null);
      announce("Entry deleted. The stats and limits have been recomputed.");
      refresh();
    } catch {
      setError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
          <StatCell
            label="Net P&L"
            value={fmtSignedUsd(stats.netPnlUsd)}
            hint={`${stats.closedTrades} closed`}
            tone={pnlTone(stats.netPnlUsd)}
          />
          <StatCell
            label="Net R"
            value={fmtR(stats.netR)}
            hint={`expectancy ${fmtR(stats.expectancyR)}`}
            tone={pnlTone(stats.netR)}
          />
          <StatCell
            label="Win rate"
            value={stats.winRate == null ? "—" : `${stats.winRate.toFixed(0)}%`}
            hint={`${stats.wins}W / ${stats.losses}L`}
          />
          <StatCell
            label="Profit factor"
            value={stats.profitFactor == null ? "—" : fmtNumber(stats.profitFactor, 2)}
            hint="gross win / gross loss"
          />
          <StatCell
            label="Trading days"
            value={String(stats.tradingDays)}
            hint={`${fmtNumber(stats.avgTradesPerDay, 1)} trades / day`}
          />
          <StatCell
            label="Discipline"
            value={stats.disciplineScore == null ? "—" : `${stats.disciplineScore}`}
            hint={stats.disciplineScore == null ? "not rated yet" : "of 100 · behaviour"}
            tone={stats.disciplineScore == null ? "text-faint" : "text-accent-bright"}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <span className={`h-1.5 w-1.5 ${mandateDot}`} aria-hidden="true" />
              <span className={`font-mono text-[9px] tracking-[0.13em] ${mandateTone}`}>{mandateWord}</span>
            </span>
            <span className="text-[10.5px] text-faint">
              Today <span className={`num ${pnlTone(guardrails.realizedTodayUsd)}`}>{fmtSignedUsd(guardrails.realizedTodayUsd)}</span>
            </span>
            <span className="text-[10.5px] text-faint">
              <span className="num text-muted">{guardrails.tradesRemaining}</span> trades left
            </span>
            <span className="text-[10.5px] text-faint">
              Open risk <span className="num text-muted">{fmtUsd(guardrails.openRiskUsd)}</span>
            </span>
          </div>
          <a
            href="/api/export"
            download
            className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-muted transition-colors hover:text-accent-bright"
          >
            <Download size={11} />
            EXPORT CSV
          </a>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 min-[1700px]:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel overflow-hidden xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[16px] text-bone">Trade book</h2>
              <span className="num text-[10px] text-faint">
                {filtered.length}
                {filtered.length !== trades.length ? ` / ${trades.length}` : ""}
              </span>
              {isPending ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[8.5px] tracking-[0.1em] text-faint">
                  <Loader2 size={10} className="animate-spin" />
                  UPDATING
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="chip !h-7 !px-2.5 !text-[10px]"
                  data-active={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {flash ? (
            <div className="flex items-start gap-2 border-b border-line bg-[rgba(95,211,155,0.055)] px-5 py-2.5 text-[11px] text-long" aria-live="polite">
              <Check size={13} className="mt-0.5 shrink-0" />
              {flash}
            </div>
          ) : null}

          {error ? (
            <div className="border-b border-line bg-[rgba(255,116,104,0.055)] px-5 py-2.5 text-[11px] text-short" role="alert">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-left sm:table-cell">
                    Date
                  </th>
                  <th scope="col" className="table-head px-3 py-2.5 text-left">
                    Trade
                  </th>
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-left md:table-cell">
                    Side
                  </th>
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-left lg:table-cell">
                    Entry / Exit
                  </th>
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-right xl:table-cell">
                    Lots
                  </th>
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-right md:table-cell">
                    Risk
                  </th>
                  <th scope="col" className="table-head px-3 py-2.5 text-right">
                    R
                  </th>
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-right sm:table-cell">
                    P&amp;L
                  </th>
                  <th scope="col" className="table-head hidden px-3 py-2.5 text-right md:table-cell">
                    Result
                  </th>
                  <th scope="col" className="table-head px-2 py-2.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-14 text-center">
                      <BookOpen size={20} className="mx-auto text-faint" strokeWidth={1.4} />
                      <p className="mt-3 text-[14px] text-bone">
                        {trades.length === 0 ? "The book is blank." : "No entries match this filter."}
                      </p>
                      <p className="mx-auto mt-2 max-w-[46ch] text-[11.5px] leading-relaxed text-faint">
                        {trades.length === 0
                          ? "Log the first trade with its real entry, stop, and size. The desk will compute the R and hold the day to its limits."
                          : "Clear the filter to see the rest of the ledger."}
                      </p>
                      {trades.length === 0 ? (
                        <a href="#new-entry" className="btn btn-primary btn-sm mt-4">
                          Log the first trade
                        </a>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setFilter("all")}>
                          Show all entries
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((trade) => {
                    const open = trade.result === "open";
                    const editing = editingId === trade.id;
                    const confirmingDelete = deleteId === trade.id;
                    return (
                      <Fragment key={trade.id}>
                        <tr
                          className={`align-middle transition-colors hover:bg-[rgba(226,242,226,0.02)] ${
                            open ? "bg-[rgba(185,243,109,0.022)]" : ""
                          }`}
                        >
                          <td className="hidden px-3 py-3 sm:table-cell">
                            <span className="num whitespace-nowrap text-[10.5px] text-muted">
                              {fmtDate(trade.tradeDate, false)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="min-w-0 max-w-[190px] sm:max-w-[320px]">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[12.5px] text-bone">
                                  {trade.setup || "Manual entry"}
                                </span>
                                {open ? (
                                  <span className="shrink-0 border border-accent/40 px-1 py-0.5 font-mono text-[8px] tracking-[0.1em] text-accent">
                                    OPEN
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[9.5px] text-faint">
                                <span className="num sm:hidden">{fmtDate(trade.tradeDate, false)}</span>
                                <span className="sm:hidden" aria-hidden="true">
                                  ·
                                </span>
                                <span
                                  className={`font-mono ${trade.direction === "long" ? "text-long" : "text-short"}`}
                                >
                                  {trade.direction.toUpperCase()}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="num">{fmtLots(trade.lots)} lots</span>
                                <span className="md:hidden" aria-hidden="true">
                                  ·
                                </span>
                                <span className="md:hidden">
                                  <ResultTag result={trade.result} />
                                </span>
                                <span className="sm:hidden" aria-hidden="true">
                                  ·
                                </span>
                                <span className={`num sm:hidden ${pnlTone(trade.pnlUsd)}`}>
                                  {fmtSignedUsd(trade.pnlUsd)}
                                </span>
                                {trade.analysisId ? (
                                  <Link
                                    href={`/review/${trade.analysisId}`}
                                    className="inline-flex items-center gap-0.5 text-accent/80 transition-colors hover:text-accent-bright"
                                  >
                                    REVIEW <ArrowUpRight size={9} />
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 md:table-cell">
                            <span
                              className={`font-mono text-[9.5px] tracking-[0.1em] ${
                                trade.direction === "long" ? "text-long" : "text-short"
                              }`}
                            >
                              {trade.direction.toUpperCase()}
                            </span>
                          </td>
                          <td className="hidden px-3 py-3 lg:table-cell">
                            <div className="num whitespace-nowrap text-[10.5px] text-muted">
                              {fmtPrice(trade.entry)} <span className="text-faint">→</span>{" "}
                              {trade.exitPrice != null ? fmtPrice(trade.exitPrice) : fmtPrice(trade.takeProfit)}
                            </div>
                            <div className="mt-0.5 font-mono text-[8.5px] text-faint">
                              {trade.exitPrice != null ? "EXIT" : "OPEN · TARGET"}
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 text-right xl:table-cell">
                            <span className="num text-[10.5px] text-muted">{fmtLots(trade.lots)}</span>
                          </td>
                          <td className="hidden px-3 py-3 text-right md:table-cell">
                            <span className="num whitespace-nowrap text-[10.5px] text-short">
                              −{fmtUsd(trade.riskUsd)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={`num whitespace-nowrap text-[11.5px] ${rTone(trade.rMultiple)}`}>
                              {fmtR(trade.rMultiple)}
                            </span>
                          </td>
                          <td className="hidden px-3 py-3 text-right sm:table-cell">
                            <span className={`num whitespace-nowrap text-[11px] ${pnlTone(trade.pnlUsd)}`}>
                              {fmtSignedUsd(trade.pnlUsd)}
                            </span>
                          </td>
                          <td className="hidden px-3 py-3 text-right md:table-cell">
                            <ResultTag result={trade.result} />
                          </td>
                          <td className="px-2 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                className="btn btn-quiet btn-sm !px-2"
                                onClick={() => {
                                  setDeleteId(null);
                                  setEditingId(editing ? null : trade.id);
                                }}
                              >
                                {open ? "Close" : "Edit"}
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${trade.setup || "trade"} entry`}
                                className="inline-flex h-8 w-7 items-center justify-center text-faint transition-colors hover:text-short"
                                onClick={() => {
                                  setEditingId(null);
                                  setDeleteId(confirmingDelete ? null : trade.id);
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {editing ? (
                          <tr>
                            <td colSpan={10} className="bg-[rgba(226,242,226,0.018)] px-3 py-3 sm:px-4">
                              <TradeEditor
                                trade={trade}
                                onCancel={() => setEditingId(null)}
                                onSaved={(message) => {
                                  setEditingId(null);
                                  announce(message);
                                  refresh();
                                }}
                              />
                            </td>
                          </tr>
                        ) : null}

                        {confirmingDelete && !editing ? (
                          <tr>
                            <td colSpan={10} className="bg-[rgba(255,116,104,0.045)] px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-[11.5px] text-muted">
                                  Delete the {fmtDate(trade.tradeDate, false)} {trade.direction} entry
                                  {trade.setup ? ` “${trade.setup}”` : ""}? This cannot be undone.
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="btn btn-quiet btn-sm"
                                    onClick={() => setDeleteId(null)}
                                    disabled={deletingId === trade.id}
                                  >
                                    Keep it
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => deleteEntry(trade.id)}
                                    disabled={deletingId === trade.id}
                                  >
                                    {deletingId === trade.id ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={12} />
                                    )}
                                    {deletingId === trade.id ? "Deleting…" : "Delete entry"}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="xl:self-start">
          <TradeEntryForm
            account={account}
            instrument={instrument}
            today={today}
            onCreated={() => {
              announce("Trade logged. The book has been updated.");
              refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
