import type { Direction, TradeResult, Verdict } from "@/lib/types";

export function verdictText(verdict: Verdict): string {
  if (verdict === "cleared") return "Cleared to trade";
  if (verdict === "wait") return "Wait for trigger";
  return "Stood down";
}

export function VerdictStamp({ verdict, compact = false }: { verdict: Verdict; compact?: boolean }) {
  const cls = verdict === "cleared" ? "stamp-cleared" : verdict === "wait" ? "stamp-wait" : "stamp-down";
  const dot = verdict === "cleared" ? "bg-long" : verdict === "wait" ? "bg-warn" : "bg-short";
  return (
    <span className={`stamp ${cls} ${compact ? "!px-2 !py-1 !text-[9px]" : ""}`}>
      <span className={`h-1.5 w-1.5 ${dot}`} aria-hidden="true" />
      {verdictText(verdict)}
    </span>
  );
}

export function DirectionTag({ direction }: { direction: Direction }) {
  if (direction === "long") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(95,211,155,0.35)] bg-[rgba(95,211,155,0.07)] px-2 py-1 font-mono text-[9.5px] tracking-[0.14em] text-long">
        LONG
      </span>
    );
  }
  if (direction === "short") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(255,116,104,0.35)] bg-[rgba(255,116,104,0.07)] px-2 py-1 font-mono text-[9.5px] tracking-[0.14em] text-short">
        SHORT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-line px-2 py-1 font-mono text-[9.5px] tracking-[0.14em] text-faint">
      NO TRADE
    </span>
  );
}

export function ResultTag({ result }: { result: TradeResult }) {
  if (result === "win") {
    return <span className="font-mono text-[10px] tracking-[0.12em] text-long">WIN</span>;
  }
  if (result === "loss") {
    return <span className="font-mono text-[10px] tracking-[0.12em] text-short">LOSS</span>;
  }
  if (result === "breakeven") {
    return <span className="font-mono text-[10px] tracking-[0.12em] text-muted">BE</span>;
  }
  return <span className="font-mono text-[10px] tracking-[0.12em] text-accent">OPEN</span>;
}

export function Confidence({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-[3px] w-14 bg-[rgba(226,242,226,0.1)]" aria-hidden="true">
        <span
          className="block h-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </span>
      <span className="num text-[11px] text-muted">{value}</span>
    </span>
  );
}
