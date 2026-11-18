import Link from "next/link";
import { fmtNumber, fmtPct } from "@/lib/format";
import type { Stats } from "@/lib/types";

function gradeFor(score: number | null): { letter: string; word: string; tone: string } {
  if (score == null) return { letter: "—", word: "Unrated", tone: "text-faint" };
  if (score >= 85) return { letter: "A", word: "Disciplined", tone: "text-long" };
  if (score >= 70) return { letter: "B", word: "Steady", tone: "text-accent-bright" };
  if (score >= 55) return { letter: "C", word: "Slipping", tone: "text-warn" };
  if (score >= 40) return { letter: "D", word: "Loose", tone: "text-short/80" };
  return { letter: "E", word: "At risk", tone: "text-short" };
}

function fillTone(ratio: number): string {
  if (ratio >= 0.8) return "var(--long)";
  if (ratio >= 0.5) return "var(--accent)";
  if (ratio > 0) return "var(--warn)";
  return "rgba(226,242,226,0.16)";
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-5 py-3.5">
      <div className="label">{label}</div>
      <div className="num mt-1.5 text-[14px] text-bone">{value}</div>
    </div>
  );
}

export function DisciplinePanel({ stats }: { stats: Stats }) {
  const grade = gradeFor(stats.disciplineScore);
  const score = stats.disciplineScore;

  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[0.78fr_2fr]">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <span className="label">Consistency audit</span>
            <span className="font-mono text-[9px] tracking-[0.16em] text-faint">BEHAVIOUR</span>
          </div>

          <div className="mt-5 flex items-end gap-3">
            <span className={`num text-[62px] leading-[0.82] tracking-[-0.05em] ${grade.tone}`}>
              {score == null ? "—" : String(score).padStart(2, "0")}
            </span>
            <div className="pb-1">
              <div className="num text-[11px] text-faint">/ 100</div>
              <div className={`mt-1 font-mono text-[10px] tracking-[0.14em] uppercase ${grade.tone}`}>
                {grade.letter} · {grade.word}
              </div>
            </div>
          </div>

          <div className="mt-5 bar-track">
            <div
              className="bar-fill"
              style={{
                transform: `scaleX(${Math.min(100, Math.max(0, score ?? 0)) / 100})`,
                background: score == null ? "transparent" : "var(--accent)",
              }}
            />
          </div>

          <p className="mt-4 max-w-[34ch] text-[11.5px] leading-relaxed text-faint">
            The score does not reward profit. It rewards sizing, plan adherence, and stopping when
            the day says stop.
          </p>

          <Link
            href="/journal"
            className="mt-4 inline-flex font-mono text-[9.5px] tracking-[0.13em] text-accent transition-colors hover:text-accent-bright"
          >
            AUDIT THE LEDGER →
          </Link>
        </div>

        <div className="flex flex-col">
          <div className="divide-y divide-line">
            {stats.disciplineParts.map((part) => {
              const ratio = part.max > 0 ? part.score / part.max : 0;
              return (
                <div key={part.key} className="px-6 py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-bone">{part.label}</div>
                      <div className="mt-0.5 truncate text-[10.5px] text-faint">{part.detail}</div>
                    </div>
                    <div className="num shrink-0 text-[11px] text-muted">
                      {part.score}
                      <span className="text-faint"> / {part.max}</span>
                    </div>
                  </div>
                  <div className="mt-2.5 bar-track !h-[3px]">
                    <div
                      className="bar-fill"
                      style={{ transform: `scaleX(${Math.min(1, Math.max(0, ratio))})`, background: fillTone(ratio) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-3">
            <MiniCell label="Trading days" value={String(stats.tradingDays)} />
            <MiniCell
              label="Avg trades / day"
              value={stats.avgTradesPerDay == null ? "—" : fmtNumber(stats.avgTradesPerDay, 1)}
            />
            <MiniCell
              label="Plan adherence"
              value={stats.planAdherencePct == null ? "—" : fmtPct(stats.planAdherencePct, 0)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
