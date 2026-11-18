import { fmtNumber, fmtPrice, fmtR, fmtUsd } from "@/lib/format";
import type { AnalysisRecord } from "@/lib/types";

interface Level {
  key: string;
  label: string;
  price: number;
  r: number | null;
  tone: string;
  dashed?: boolean;
}

export function RiskMap({ analysis }: { analysis: AnalysisRecord }) {
  const { raw, riskPlan } = analysis;
  const entry = raw.entry;
  const stop = raw.stopLoss;
  const tp1 = raw.takeProfit1;
  const tp2 = raw.takeProfit2;

  if (entry == null || stop == null || raw.direction === "none") {
    return (
      <div className="flex min-h-[280px] flex-col justify-center border border-dashed border-line px-6 py-8">
        <span className="label">Risk map</span>
        <p className="mt-3 font-mono text-[15px] tracking-[0.04em] text-faint">NO LADDER WRITTEN</p>
        <p className="mt-2 max-w-[32ch] text-[11.5px] leading-relaxed text-faint">
          The desk will not draw a price ladder without an entry, an invalidation, and a readable
          axis.
        </p>
      </div>
    );
  }

  const width = 400;
  const height = 326;
  const padTop = 28;
  const padBottom = 24;
  const lineStart = 96;
  const lineEnd = width - 104;

  const rawLevels: Level[] = [
    {
      key: "tp2",
      label: "TP2",
      price: tp2 ?? Number.NaN,
      r: riskPlan?.rr2 ?? null,
      tone: "var(--long)",
      dashed: true,
    },
    {
      key: "tp1",
      label: "TP1",
      price: tp1 ?? Number.NaN,
      r: riskPlan?.rr1 ?? null,
      tone: "var(--long)",
    },
    { key: "entry", label: "ENTRY", price: entry, r: 0, tone: "var(--accent)" },
    { key: "stop", label: "STOP", price: stop, r: -1, tone: "var(--short)" },
  ];

  const seen = new Set<number>();
  const levels = rawLevels.filter((level) => {
    if (!Number.isFinite(level.price) || seen.has(level.price)) return false;
    seen.add(level.price);
    return true;
  });

  const prices = levels.map((level) => level.price);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const spread = Math.max(1, rawMax - rawMin);
  const min = rawMin - spread * 0.16;
  const max = rawMax + spread * 0.16;

  const y = (price: number) => padTop + ((max - price) / (max - min)) * (height - padTop - padBottom);
  const entryY = y(entry);
  const stopY = y(stop);

  const targets = levels.filter((level) => level.key === "tp1" || level.key === "tp2").map((level) => level.price);
  const targetY = targets.length > 0 ? y(raw.direction === "long" ? Math.max(...targets) : Math.min(...targets)) : entryY;

  const topBand = Math.min(entryY, targetY);
  const bandHeight = Math.abs(entryY - targetY);
  const stopTop = Math.min(entryY, stopY);
  const stopHeight = Math.abs(entryY - stopY);

  const distanceToStop = Math.abs(entry - stop);
  const stopPips = riskPlan?.stopPips ?? distanceToStop / 0.1;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="label">Risk map</span>
        <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-faint">
          {raw.direction} · {raw.entryType}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label={`Price ladder for a ${raw.direction} from ${fmtPrice(entry)} with stop at ${fmtPrice(stop)}`}
      >
        <title>
          {`${raw.direction === "long" ? "Long" : "Short"} risk map: entry ${fmtPrice(entry)}, stop ${fmtPrice(stop)}, TP1 ${fmtPrice(tp1)}`}
        </title>

        <rect
          x={lineStart}
          y={topBand}
          width={lineEnd - lineStart}
          height={Math.max(1, bandHeight)}
          fill="var(--long)"
          opacity="0.07"
        />
        <rect
          x={lineStart}
          y={stopTop}
          width={lineEnd - lineStart}
          height={Math.max(1, stopHeight)}
          fill="var(--short)"
          opacity="0.075"
        />

        {levels.map((level) => {
          const levelY = y(level.price);
          const isEntry = level.key === "entry";
          return (
            <g key={level.key}>
              <text
                x={18}
                y={levelY - 4}
                fill={isEntry ? "var(--accent-bright)" : "var(--faint)"}
                fontFamily="var(--font-mono)"
                fontSize="8.5"
                letterSpacing="1.4"
              >
                {level.label}
              </text>
              <text
                x={18}
                y={levelY + 11}
                fill={level.r == null ? "var(--faint)" : level.tone}
                fontFamily="var(--font-mono)"
                fontSize="9.5"
              >
                {level.r == null ? "—" : fmtR(level.r)}
              </text>

              <line
                x1={lineStart}
                x2={lineEnd}
                y1={levelY}
                y2={levelY}
                stroke={level.tone}
                strokeWidth={isEntry ? 1.6 : 1}
                strokeOpacity={isEntry ? 0.95 : 0.65}
                strokeDasharray={level.dashed ? "3 4" : undefined}
              />
              <circle cx={lineStart} cy={levelY} r={isEntry ? 3.4 : 2.4} fill={level.tone} />

              <text
                x={width - 8}
                y={levelY + 3.5}
                textAnchor="end"
                fill={isEntry ? "var(--bone)" : "var(--muted)"}
                fontFamily="var(--font-mono)"
                fontSize={isEntry ? "12.5" : "11.5"}
              >
                {fmtPrice(level.price)}
              </text>
            </g>
          );
        })}

        {raw.direction === "long" ? (
          <g>
            <line
              x1={lineEnd + 10}
              x2={lineEnd + 10}
              y1={entryY}
              y2={stopY}
              stroke="var(--short)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
            <line x1={lineEnd + 6} x2={lineEnd + 14} y1={entryY} y2={entryY} stroke="var(--short)" strokeOpacity="0.35" />
            <line x1={lineEnd + 6} x2={lineEnd + 14} y1={stopY} y2={stopY} stroke="var(--short)" strokeOpacity="0.35" />
          </g>
        ) : (
          <g>
            <line
              x1={lineEnd + 10}
              x2={lineEnd + 10}
              y1={entryY}
              y2={stopY}
              stroke="var(--short)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
            <line x1={lineEnd + 6} x2={lineEnd + 14} y1={entryY} y2={entryY} stroke="var(--short)" strokeOpacity="0.35" />
            <line x1={lineEnd + 6} x2={lineEnd + 14} y1={stopY} y2={stopY} stroke="var(--short)" strokeOpacity="0.35" />
          </g>
        )}

        <text
          x={lineStart}
          y={height - 4}
          fill="var(--faint)"
          fontFamily="var(--font-mono)"
          fontSize="8"
          letterSpacing="1.2"
        >
          1R = {riskPlan ? fmtUsd(riskPlan.riskUsd) : "—"}
        </text>
        <text
          x={width - 8}
          y={height - 4}
          textAnchor="end"
          fill="var(--faint)"
          fontFamily="var(--font-mono)"
          fontSize="8"
          letterSpacing="1.2"
        >
          {fmtPrice(distanceToStop)} TO STOP
        </text>
      </svg>

      <div className="mt-3 grid grid-cols-2 gap-px border border-line bg-line">
        <div className="bg-panel-2 px-3 py-2.5">
          <div className="label">Stop distance</div>
          <div className="num mt-1 text-[12px] text-bone">
            {fmtPrice(distanceToStop)} <span className="text-faint">/ {fmtNumber(stopPips, 0)} pips</span>
          </div>
        </div>
        <div className="bg-panel-2 px-3 py-2.5">
          <div className="label">R:R to TP1</div>
          <div className="num mt-1 text-[12px] text-bone">{riskPlan?.rr1 == null ? "—" : fmtR(riskPlan.rr1)}</div>
        </div>
      </div>
    </div>
  );
}
