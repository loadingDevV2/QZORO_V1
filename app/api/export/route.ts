import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import { listTrades } from "@/lib/db";
import { deskDateKey } from "@/lib/desk-time";

// Large journals are paginated but the export still runs as one response.
export const maxDuration = 60;

function cell(value: unknown): string {
  if (value == null) return "";
  const raw = String(value);
  // Spreadsheet apps may evaluate a quoted CSV cell as a formula. Prefix only
  // string fields so numeric negatives (PnL, R multiple) stay numeric.
  const text = typeof value === "string" && /^\s*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  let trades;
  try {
    trades = await listTrades(session.user.id);
  } catch (error) {
    console.error("[export] read failed", error);
    return Response.json({ error: "The ledger could not be exported." }, { status: 500 });
  }

  const header = [
    "trade_date",
    "symbol",
    "direction",
    "setup",
    "entry",
    "stop_loss",
    "take_profit",
    "exit_price",
    "lots",
    "risk_usd",
    "risk_pct",
    "planned_rr",
    "result",
    "r_multiple",
    "pnl_usd",
    "followed_plan",
    "source",
    "notes",
  ];

  const rows = trades.map((trade) =>
    [
      trade.tradeDate,
      trade.symbol,
      trade.direction,
      trade.setup,
      trade.entry,
      trade.stopLoss,
      trade.takeProfit,
      trade.exitPrice,
      trade.lots,
      trade.riskUsd,
      trade.riskPct,
      trade.plannedRr,
      trade.result,
      trade.rMultiple,
      trade.pnlUsd,
      trade.followedPlan ? "yes" : "no",
      trade.source,
      trade.notes,
    ]
      .map(cell)
      .join(","),
  );

  const csv = [header.map(cell).join(","), ...rows].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="qzoro-trades-${deskDateKey()}.csv"`,
      "cache-control": "no-store",
    },
  });
}
