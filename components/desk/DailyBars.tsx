import { fmtDate, fmtR } from "@/lib/format";
import type { DailyStat } from "@/lib/types";

export function DailyBars({ daily }: { daily: DailyStat[] }) {
  const rows = daily.slice(-10);
  const maxAbs = Math.max(0.5, ...rows.map((row) => Math.abs(row.r)));

  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] text-bone">Last sessions</h2>
          <p className="mt-1 text-[11.5px] text-faint">Daily R, not dollars — size changes, risk should not.</p>
        </div>
        <span className="label">R</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center px-5 py-8">
          <p className="text-[12.5px] leading-relaxed text-faint">
            No sessions on record. The bars fill in when a trade closes.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-5 py-4">
          <div className="relative mt-1 flex flex-1 items-stretch gap-1.5">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[rgba(226,242,226,0.1)]" aria-hidden="true" />
            {rows.map((row) => {
              const height = Math.min(46, (Math.abs(row.r) / maxAbs) * 46);
              const positive = row.r >= 0;
              return (
                <div
                  key={row.date}
                  className="group relative flex flex-1 flex-col items-center"
                  title={`${fmtDate(row.date)} · ${fmtR(row.r)} · ${row.trades} trade${row.trades === 1 ? "" : "s"}`}
                >
                  <div className="relative h-[96px] w-full">
                    <div
                      className="absolute left-1/2 w-full max-w-[18px] -translate-x-1/2 rounded-[2px]"
                      style={{
                        height: `${Math.max(2, height)}px`,
                        background: positive ? "var(--long)" : "var(--short)",
                        opacity: 0.85,
                        ...(positive
                          ? { bottom: "50%" }
                          : { top: "50%" }),
                      }}
                    />
                  </div>
                  <span className="num mt-1 text-[9px] text-faint">{row.date.slice(8)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <span className="font-mono text-[9px] text-faint">{fmtDate(rows[0].date, false)}</span>
            <span className={`num text-[10px] ${rows[rows.length - 1].r >= 0 ? "text-long" : "text-short"}`}>
              {fmtR(rows.reduce((sum, row) => sum + row.r, 0))} recent
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
