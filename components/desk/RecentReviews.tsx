import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import type { AnalysisSummary } from "@/lib/types";
import { DirectionTag } from "../ui/Badges";

function MiniVerdict({ verdict }: { verdict: AnalysisSummary["verdict"] }) {
  if (verdict === "cleared") {
    return <span className="font-mono text-[9px] tracking-[0.14em] text-long">CLEARED</span>;
  }
  if (verdict === "wait") {
    return <span className="font-mono text-[9px] tracking-[0.14em] text-warn">WAIT</span>;
  }
  return <span className="font-mono text-[9px] tracking-[0.14em] text-short">STOOD DOWN</span>;
}

function Thumb({ src }: { src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={52}
        height={36}
        className="h-9 w-[52px] border border-line object-cover opacity-80"
      />
    );
  }
  return (
    <div className="flex h-9 w-[52px] items-center justify-center border border-line bg-ink-2">
      <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden="true">
        <path d="M1 11 6 5l4 3.4L19 2" stroke="var(--faint)" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function RecentReviews({ analyses }: { analyses: AnalysisSummary[] }) {
  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] text-bone">Recent reviews</h2>
          <p className="mt-1 text-[11.5px] text-faint">What the desk saw, and whether it fired.</p>
        </div>
        <Link href="/analyze" className="link-underline shrink-0 font-mono text-[10px] tracking-[0.1em] text-accent">
          REVIEW →
        </Link>
      </div>

      {analyses.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center px-5 py-8">
          <p className="text-[12.5px] leading-relaxed text-faint">
            No charts reviewed yet. Upload a screenshot and the desk will file its read here.
          </p>
          <Link href="/analyze" className="mt-3 inline-flex w-fit items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-accent">
            OPEN CHART REVIEW <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {analyses.slice(0, 5).map((analysis) => (
            <Link
              key={analysis.id}
              href={`/review/${analysis.id}`}
              className="group grid grid-cols-[52px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-[rgba(226,242,226,0.025)]"
            >
              <Thumb src={analysis.imageUrl} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] text-bone">{analysis.setupName}</span>
                  {analysis.demo ? (
                    <span className="shrink-0 border border-line px-1.5 py-0.5 font-mono text-[8px] tracking-[0.12em] text-faint">
                      SAMPLE
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-faint">
                  <span className="num">{analysis.timeframe || "—"}</span>
                  <span aria-hidden="true">·</span>
                  <DirectionTag direction={analysis.direction} />
                  <span className="num">{analysis.confidence}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmtDateTime(analysis.createdAt)}</span>
                </div>
              </div>
              <MiniVerdict verdict={analysis.verdict} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
