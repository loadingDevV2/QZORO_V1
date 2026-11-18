import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Confidence, DirectionTag, VerdictStamp } from "@/components/ui/Badges";
import { RiskMap } from "@/components/analyze/RiskMap";
import { TicketActions } from "@/components/analyze/TicketActions";
import { PROVIDER_LABEL } from "@/lib/constants";
import {
  fmtDateTime,
  fmtLots,
  fmtNumber,
  fmtPct,
  fmtPrice,
  fmtR,
  fmtUsd,
} from "@/lib/format";
import type { AnalysisRecord } from "@/lib/types";

function serialFor(analysis: AnalysisRecord): string {
  if (!analysis.id) return "QZ-SAMPLE";
  return `QZ-${analysis.id.slice(0, 6).toUpperCase()}`;
}

function signedMove(from: number, to: number): string {
  const diff = to - from;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return `${sign}${fmtPrice(Math.abs(diff))}`;
}

function Section({
  index,
  label,
  children,
}: {
  index: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[9px] tracking-[0.16em] text-accent">{index}</span>
        <h3 className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">{label}</h3>
      </div>
      <div className="mt-2 break-words text-[12.5px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function AnalysisTicket({
  analysis,
  imageUrl,
  alreadyLogged = false,
  today,
  onLogged,
}: {
  analysis: AnalysisRecord;
  imageUrl?: string | null;
  alreadyLogged?: boolean;
  today: string;
  onLogged?: () => void;
}) {
  const { raw, riskPlan } = analysis;
  const hasLevels = raw.direction !== "none" && raw.entry != null && raw.stopLoss != null;
  const chartUrl = imageUrl ?? analysis.imageUrl;
  const providerName = analysis.demo
    ? "Sample desk"
    : (PROVIDER_LABEL[analysis.provider as keyof typeof PROVIDER_LABEL] ?? analysis.provider);

  const levels = [
    {
      key: "tp2",
      label: "TP2",
      price: raw.takeProfit2,
      r: riskPlan?.rr2 ?? null,
      tone: "text-long",
      note: "extension",
    },
    {
      key: "tp1",
      label: "TP1",
      price: raw.takeProfit1,
      r: riskPlan?.rr1 ?? null,
      tone: "text-long",
      note: "first target",
    },
    {
      key: "entry",
      label: "ENTRY",
      price: raw.entry,
      r: 0,
      tone: "text-accent-bright",
      note: raw.entryType,
    },
    {
      key: "stop",
      label: "STOP",
      price: raw.stopLoss,
      r: -1,
      tone: "text-short",
      note: "invalidation",
    },
  ].filter((level) => level.price != null);

  const veto = analysis.verdict !== "cleared";
  const decisionLabel =
    analysis.verdict === "wait"
      ? "Why the desk is waiting"
      : analysis.verdict === "stood-down"
        ? "Why the desk stood down"
        : "Conditions on the clearance";

  return (
    <article className="panel ticket-enter overflow-hidden">
      <header className="border-b border-line bg-panel-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label">Trade ticket</span>
            <span className="font-mono text-[9.5px] tracking-[0.16em] text-faint">{serialFor(analysis)}</span>
            {analysis.demo ? (
              <span className="border border-accent/40 bg-[rgba(185,243,109,0.07)] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.14em] text-accent-bright">
                SAMPLE
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="num text-[9.5px] text-faint">{fmtDateTime(analysis.createdAt)}</span>
            <VerdictStamp verdict={analysis.verdict} />
          </div>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[1.45fr_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <DirectionTag direction={raw.direction} />
              <span className="num text-[10.5px] uppercase tracking-[0.08em] text-muted">
                {analysis.timeframe || raw.timeframe}
              </span>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                {raw.setupType}
              </span>
              {analysis.session ? (
                <>
                  <span aria-hidden="true" className="text-faint">
                    ·
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                    {analysis.session}
                  </span>
                </>
              ) : null}
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <Confidence value={raw.confidence} />
            </div>

            <h2 className="mt-3 break-words text-[22px] leading-[1.15] tracking-[-0.03em] text-bone sm:text-[26px]">
              {raw.setupName}
            </h2>
            <p className="mt-2 max-w-[78ch] break-words text-[12px] leading-relaxed text-faint">
              {raw.readQuality || "No read-quality note was returned."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-7 gap-y-3 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <div className="label">Risk at stop</div>
              <div className="num mt-1.5 text-[20px] leading-none text-bone">
                {riskPlan ? fmtUsd(riskPlan.lossAtStopUsd) : "—"}
              </div>
              <div className="mt-1 text-[10px] text-faint">
                {riskPlan ? `${fmtPct(riskPlan.riskPct, 2)} · ${fmtLots(riskPlan.lots)} lots` : "No size"}
              </div>
            </div>
            <div>
              <div className="label">To TP1</div>
              <div className={`num mt-1.5 text-[20px] leading-none ${riskPlan?.rr1 != null ? "text-long" : "text-bone"}`}>
                {riskPlan?.rr1 == null ? "—" : fmtR(riskPlan.rr1)}
              </div>
              <div className="mt-1 text-[10px] text-faint">
                {analysis.demo ? "Illustrative levels" : `${providerName} read`}
              </div>
            </div>
          </div>
        </div>
      </header>

      {analysis.verdictReasons.length > 0 ? (
        <div
          className={`border-b border-line px-5 py-4 sm:px-6 ${
            analysis.verdict === "cleared"
              ? "bg-[rgba(95,211,155,0.04)]"
              : analysis.verdict === "wait"
                ? "bg-[rgba(230,180,90,0.05)]"
                : "bg-[rgba(255,116,104,0.045)]"
          }`}
        >
          <div className="flex items-center gap-2">
            {veto ? (
              <AlertTriangle
                size={12}
                className={analysis.verdict === "wait" ? "text-warn" : "text-short"}
                strokeWidth={1.8}
              />
            ) : (
              <span className="h-1.5 w-1.5 bg-long" aria-hidden="true" />
            )}
            <span className="label">{decisionLabel}</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {analysis.verdictReasons.slice(0, 5).map((reason) => (
              <li key={reason} className="flex gap-2.5 break-words text-[11.5px] leading-relaxed text-muted">
                <span
                  className={`mt-[7px] h-1 w-1 shrink-0 ${
                    analysis.verdict === "wait" ? "bg-warn" : analysis.verdict === "stood-down" ? "bg-short" : "bg-long"
                  }`}
                  aria-hidden="true"
                />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1.32fr_0.78fr]">
        <div className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
          {hasLevels ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="label">Price ladder</span>
                <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-faint">
                  {raw.direction} · {raw.entryType}
                </span>
              </div>

              <div className="mt-2 divide-y divide-line border-y border-line">
                {levels.map((level) => {
                  const price = level.price as number;
                  const isEntry = level.key === "entry";
                  return (
                    <div
                      key={level.key}
                      className={`grid grid-cols-[54px_minmax(0,1fr)_auto] items-baseline gap-3 py-3 ${
                        isEntry ? "bg-[rgba(185,243,109,0.035)]" : ""
                      }`}
                    >
                      <span className={`font-mono text-[9px] tracking-[0.14em] ${level.tone}`}>
                        {level.label}
                      </span>
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span
                          className={`num text-[18px] leading-none ${isEntry ? "text-accent-bright" : "text-bone"}`}
                        >
                          {fmtPrice(price)}
                        </span>
                        <span className="text-[10px] text-faint">
                          {isEntry
                            ? level.note
                            : `${signedMove(raw.entry as number, price)} / ${level.note}`}
                        </span>
                      </div>
                      <span
                        className={`num text-right text-[11.5px] ${
                          isEntry ? "text-faint" : level.key === "stop" ? "text-short" : "text-long"
                        }`}
                      >
                        {level.r == null ? "—" : fmtR(level.r)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {riskPlan ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
                    <div className="bg-panel px-4 py-3.5">
                      <div className="label">Size</div>
                      <div className="num mt-1.5 text-[16px] text-bone">{fmtLots(riskPlan.lots)}</div>
                      <div className="mt-0.5 text-[10px] text-faint">
                        lots · {fmtNumber(riskPlan.unitsOz, 0)} oz
                      </div>
                    </div>
                    <div className="bg-panel px-4 py-3.5">
                      <div className="label">Risk</div>
                      <div className="num mt-1.5 text-[16px] text-short">−{fmtUsd(riskPlan.riskUsd)}</div>
                      <div className="mt-0.5 text-[10px] text-faint">{fmtPct(riskPlan.riskPct, 2)} of account</div>
                    </div>
                    <div className="bg-panel px-4 py-3.5">
                      <div className="label">TP1 net</div>
                      <div className="num mt-1.5 text-[16px] text-long">
                        {riskPlan.profitTp1Usd == null ? "—" : `+${fmtUsd(riskPlan.profitTp1Usd)}`}
                      </div>
                      <div className="mt-0.5 text-[10px] text-faint">after costs</div>
                    </div>
                    <div className="bg-panel px-4 py-3.5">
                      <div className="label">Costs</div>
                      <div className="num mt-1.5 text-[16px] text-muted">
                        {fmtUsd(riskPlan.spreadCostUsd + riskPlan.commissionUsd)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-faint">spread + commission</div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-faint">
                    <span>
                      Notional {fmtUsd(riskPlan.notionalUsd)} · stop {fmtPrice(riskPlan.stopDistance)} /{" "}
                      {fmtNumber(riskPlan.stopPips, 0)} pips
                    </span>
                    <span>Target risk {fmtPct(riskPlan.targetRiskPct, 2)} of account</span>
                  </div>

                  {!riskPlan.ok && riskPlan.reason ? (
                    <div className="mt-3 break-words border border-[rgba(230,180,90,0.35)] bg-[rgba(230,180,90,0.06)] px-3 py-2.5 text-[11px] leading-relaxed text-warn">
                      {riskPlan.reason}
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <div className="border border-dashed border-line px-5 py-10">
              <span className="label">No ticket</span>
              <p className="mt-3 max-w-[44ch] text-[13px] leading-relaxed text-muted">
                The desk refused to quote an entry. A refusal is a result: there is no defensible
                stop, no target worth the risk, or no readable price axis.
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Section index="01" label="Trigger">
              {raw.trigger || "No activation condition was returned."}
            </Section>
            <Section index="02" label="Invalidation">
              {raw.invalidation || "No invalidation was returned."}
            </Section>
            <Section index="03" label="Management">
              {raw.management || "No management note was returned."}
            </Section>
            <Section index="04" label="Read">
              {raw.structure || "No structure note was returned."}
            </Section>
          </div>

          <div className="mt-6">
            <Section index="05" label="Desk note">
              {raw.reasoning || "No reasoning was returned."}
            </Section>
          </div>

          {raw.confluences.length > 0 ? (
            <div className="mt-6 border-t border-line pt-5">
              <span className="label">Confluences</span>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {raw.confluences.map((item) => (
                  <li key={item} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 bg-accent" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {raw.warnings.length > 0 ? (
            <div className="mt-6 border border-[rgba(230,180,90,0.28)] bg-[rgba(230,180,90,0.045)] px-4 py-3.5">
              <div className="flex items-center gap-2 text-warn">
                <AlertTriangle size={12} strokeWidth={1.8} />
                <span className="font-mono text-[9px] tracking-[0.16em] uppercase">Warnings</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {raw.warnings.map((warning) => (
                  <li key={warning} className="break-words text-[11px] leading-relaxed text-warn/90">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col p-5 sm:p-6">
          {chartUrl ? (
            <div className="border border-line bg-ink-2 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={chartUrl}
                alt="The chart submitted for this review"
                className="max-h-[190px] w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex min-h-[104px] items-center justify-center border border-dashed border-line px-5 py-5 text-center">
              <div>
                <span className="label">{analysis.demo ? "Worked example" : "Chart not archived"}</span>
                <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                  {analysis.demo
                    ? "No chart is attached to the sample. The levels are illustrative and must not be traded."
                    : "This review was filed without a stored screenshot. The levels and the mandate below are still the record."}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5">
            <RiskMap analysis={analysis} />
          </div>

          {raw.supports.length > 0 || raw.resistances.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <div>
                <div className="label">Supports</div>
                <ul className="mt-2 space-y-1.5">
                  {raw.supports.slice(0, 5).map((level) => (
                    <li key={level} className="num text-[11.5px] text-long">
                      {fmtPrice(level)}
                    </li>
                  ))}
                  {raw.supports.length === 0 ? <li className="text-[11px] text-faint">—</li> : null}
                </ul>
              </div>
              <div>
                <div className="label">Resistances</div>
                <ul className="mt-2 space-y-1.5">
                  {raw.resistances.slice(0, 5).map((level) => (
                    <li key={level} className="num text-[11.5px] text-short">
                      {fmtPrice(level)}
                    </li>
                  ))}
                  {raw.resistances.length === 0 ? <li className="text-[11px] text-faint">—</li> : null}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="mt-auto border-t border-line pt-5">
            <TicketActions
              analysis={analysis}
              alreadyLogged={alreadyLogged}
              today={today}
              onLogged={onLogged}
            />
            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              Verify every level against your own chart before placing an order. The desk does not
              connect to a broker and cannot place, close, or protect a trade.
            </p>
          </div>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
        <p className="text-[10px] text-faint">
          Levels read by {providerName}
          {analysis.demo ? "" : ` / ${analysis.model}`}. Size, R:R, and limits computed by the desk.
        </p>
        <span className="font-mono text-[9px] tracking-[0.12em] text-faint">
          {(raw.instrument || "Unknown").toUpperCase()} · {serialFor(analysis)}
        </span>
      </footer>
    </article>
  );
}
