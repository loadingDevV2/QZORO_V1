import Link from "next/link";
import { fmtR, fmtUsd } from "@/lib/format";
import type { EquityPoint, Stats } from "@/lib/types";

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`num mt-1.5 text-[15px] ${tone ?? "text-bone"}`}>{value}</div>
    </div>
  );
}

function Chart({ points }: { points: EquityPoint[] }) {
  const width = 820;
  const height = 220;
  const padL = 54;
  const padR = 20;
  const padT = 20;
  const padB = 30;

  const values = [0, ...points.map((point) => point.cumulativeR)];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(0.5, rawMax - rawMin);
  const min = rawMin - spread * 0.12;
  const max = rawMax + spread * 0.12;

  const x = (index: number) =>
    padL + (index / Math.max(1, points.length - 1)) * (width - padL - padR);
  const y = (value: number) =>
    padT + ((max - value) / (max - min)) * (height - padT - padB);

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(point.cumulativeR).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const ticks = [max, (max + min) / 2, min];
  const last = points[points.length - 1];
  const curveTone = last.cumulativeR < 0 ? "var(--short)" : "var(--long)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Cumulative R curve across ${points.length} closed trades`}
    >
      <title>{`Cumulative R: ${fmtR(last?.cumulativeR ?? 0)} over ${points.length} closed trades`}</title>
      <defs>
        <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={curveTone} stopOpacity="0.18" />
          <stop offset="100%" stopColor={curveTone} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={padL}
            x2={width - padR}
            y1={y(tick)}
            y2={y(tick)}
            stroke="rgba(226,242,226,0.07)"
            strokeDasharray={tick === 0 ? undefined : "2 5"}
          />
          <text
            x={padL - 10}
            y={y(tick) + 3}
            textAnchor="end"
            fill="var(--faint)"
            fontFamily="var(--font-mono)"
            fontSize="9.5"
          >
            {tick === 0 ? "0" : fmtR(tick, 1)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#equityFill)" />
      <path d={line} fill="none" stroke={curveTone} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.cumulativeR)} r="3" fill={curveTone} />
      <circle cx={x(points.length - 1)} cy={y(last.cumulativeR)} r="6" fill="none" stroke={curveTone} strokeOpacity="0.4" />

      <text
        x={x(points.length - 1)}
        y={y(last.cumulativeR) - 12}
        textAnchor="end"
        fill="var(--bone)"
        fontFamily="var(--font-mono)"
        fontSize="10.5"
      >
        {fmtR(last.cumulativeR)}
      </text>

      <text x={padL} y={height - 8} fill="var(--faint)" fontFamily="var(--font-mono)" fontSize="9">
        {points[0]?.label}
      </text>
      <text
        x={width - padR}
        y={height - 8}
        textAnchor="end"
        fill="var(--faint)"
        fontFamily="var(--font-mono)"
        fontSize="9"
      >
        {last.label}
      </text>
    </svg>
  );
}

export function EquityPanel({ stats }: { stats: Stats }) {
  return (
    <section className="panel flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-[17px] text-bone">Equity, in R</h2>
          <p className="mt-1 text-[12px] text-faint">
            {stats.closedTrades > 0
              ? `${stats.closedTrades} closed trade${stats.closedTrades === 1 ? "" : "s"} · ${fmtUsd(stats.netPnlUsd)} net`
              : "Closed trades only. Open positions are not counted."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <MiniStat label="Net R" value={fmtR(stats.netR)} tone={stats.netR >= 0 ? "text-long" : "text-short"} />
          <MiniStat label="Expectancy" value={stats.expectancyR == null ? "—" : fmtR(stats.expectancyR)} />
          <MiniStat label="Win rate" value={stats.winRate == null ? "—" : `${stats.winRate.toFixed(0)}%`} />
          <MiniStat label="Max drawdown" value={stats.closedTrades > 0 ? fmtR(-stats.maxDrawdownR) : "—"} tone="text-short" />
        </div>
      </div>

      <div className="flex flex-1 items-center px-3 py-4">
        {stats.equity.length >= 2 ? (
          <Chart points={stats.equity} />
        ) : (
          <div className="relative flex h-[210px] w-full items-center justify-center px-6">
            <div className="absolute inset-x-8 top-1/2 h-px bg-[rgba(226,242,226,0.08)]" aria-hidden="true" />
            <div className="relative max-w-[42ch] bg-panel px-5 py-4 text-center">
              <p className="text-[13px] text-muted">
                {stats.totalTrades === 0
                  ? "The ledger is empty. The first closed trade starts the curve."
                  : "One closed trade is a dot, not a curve. The shape arrives with the second."}
              </p>
              <Link href="/journal" className="link-underline mt-2 inline-block font-mono text-[10px] tracking-[0.12em] text-accent">
                LOG A TRADE →
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
