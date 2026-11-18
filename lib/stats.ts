import { fmtDate } from "./format";
import type {
  DailyStat,
  DeskSettings,
  DisciplinePart,
  EquityPoint,
  Stats,
  Trade,
} from "./types";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeStats(trades: Trade[], settings: DeskSettings): Stats {
  const all = [...trades].sort((a, b) =>
    (a.tradeDate + a.createdAt).localeCompare(b.tradeDate + b.createdAt),
  );
  const closed = all.filter((t) => t.result !== "open");
  const open = all.filter((t) => t.result === "open");
  const wins = closed.filter((t) => t.result === "win");
  const losses = closed.filter((t) => t.result === "loss");
  const breakevens = closed.filter((t) => t.result === "breakeven");

  const winRate = wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : null;
  const netPnl = closed.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const netR = closed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const winRs = wins.map((t) => t.rMultiple ?? 0);
  const lossRs = losses.map((t) => t.rMultiple ?? 0);

  const grossWin = closed.reduce((sum, t) => sum + Math.max(0, t.pnlUsd ?? 0), 0);
  const grossLoss = closed.reduce((sum, t) => sum + Math.min(0, t.pnlUsd ?? 0), 0);
  const profitFactor = grossLoss < 0 ? grossWin / Math.abs(grossLoss) : null;

  let peakR = 0;
  let cumulativeR = 0;
  let maxDrawdownR = 0;
  let peakUsd = 0;
  let cumulativeUsd = 0;
  let maxDrawdownUsd = 0;

  const equity: EquityPoint[] = [];
  for (const trade of closed) {
    cumulativeR += trade.rMultiple ?? 0;
    cumulativeUsd += trade.pnlUsd ?? 0;
    peakR = Math.max(peakR, cumulativeR);
    peakUsd = Math.max(peakUsd, cumulativeUsd);
    maxDrawdownR = Math.max(maxDrawdownR, peakR - cumulativeR);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peakUsd - cumulativeUsd);
    equity.push({
      date: trade.tradeDate,
      label: fmtDate(trade.tradeDate, false),
      cumulativeR,
      cumulativeUsd,
    });
  }

  let maxLossStreak = 0;
  let runningLosses = 0;
  for (const trade of closed) {
    if (trade.result === "loss") {
      runningLosses += 1;
      maxLossStreak = Math.max(maxLossStreak, runningLosses);
    } else {
      runningLosses = 0;
    }
  }

  let currentStreak: Stats["currentStreak"] = { type: "none", count: 0 };
  for (let i = closed.length - 1; i >= 0; i -= 1) {
    const type = closed[i].result === "win" ? "win" : closed[i].result === "loss" ? "loss" : null;
    if (!type) break;
    if (currentStreak.type === "none") currentStreak = { type, count: 1 };
    else if (currentStreak.type === type) currentStreak.count += 1;
    else break;
  }

  const dailyMap = new Map<string, DailyStat>();
  for (const trade of closed) {
    const entry = dailyMap.get(trade.tradeDate) ?? { date: trade.tradeDate, pnlUsd: 0, r: 0, trades: 0 };
    entry.pnlUsd += trade.pnlUsd ?? 0;
    entry.r += trade.rMultiple ?? 0;
    entry.trades += 1;
    dailyMap.set(trade.tradeDate, entry);
  }
  const tradeCountByDay = new Map<string, number>();
  for (const trade of all) {
    tradeCountByDay.set(trade.tradeDate, (tradeCountByDay.get(trade.tradeDate) ?? 0) + 1);
  }
  for (const [date, count] of tradeCountByDay) {
    const entry = dailyMap.get(date) ?? { date, pnlUsd: 0, r: 0, trades: 0 };
    entry.trades = Math.max(entry.trades, count);
    dailyMap.set(date, entry);
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const tradingDays = daily.length;

  const dailyLimit = (settings.account.balance * settings.account.maxDailyLossPct) / 100;
  const daysWithinLoss = daily.filter((d) => d.pnlUsd >= -dailyLimit).length;
  const daysInsideTradeCap = daily.filter((d) => d.trades <= settings.account.maxTradesPerDay).length;

  const riskCompliant = all.filter(
    (t) => t.riskPct <= settings.account.riskPerTradePct * 1.05,
  ).length;
  const adherence = closed.filter((t) => t.followedPlan).length;

  const disciplineParts: DisciplinePart[] = [
    {
      key: "risk",
      label: "Risk per trade",
      score: all.length > 0 ? Math.round((riskCompliant / all.length) * 30) : 0,
      max: 30,
      detail:
        all.length > 0
          ? `${riskCompliant} of ${all.length} entries inside ${settings.account.riskPerTradePct}%`
          : "No entries yet",
    },
    {
      key: "plan",
      label: "Plan followed",
      score: closed.length > 0 ? Math.round((adherence / closed.length) * 25) : 0,
      max: 25,
      detail:
        closed.length > 0
          ? `${adherence} of ${closed.length} closed trades followed the plan`
          : "No closed trades yet",
    },
    {
      key: "daily",
      label: "Daily stop respected",
      score: tradingDays > 0 ? Math.round((daysWithinLoss / tradingDays) * 25) : 0,
      max: 25,
      detail:
        tradingDays > 0
          ? `${daysWithinLoss} of ${tradingDays} days inside the ${settings.account.maxDailyLossPct}% stop`
          : "No sessions yet",
    },
    {
      key: "cap",
      label: "Trade cap respected",
      score: tradingDays > 0 ? Math.round((daysInsideTradeCap / tradingDays) * 20) : 0,
      max: 20,
      detail:
        tradingDays > 0
          ? `${daysInsideTradeCap} of ${tradingDays} days at or under ${settings.account.maxTradesPerDay} trades`
          : "No sessions yet",
    },
  ];

  const disciplineScore =
    all.length > 0
      ? disciplineParts.reduce((sum, part) => sum + part.score, 0)
      : null;

  const bestDay = daily.length > 0 ? Math.max(...daily.map((d) => d.pnlUsd)) : null;
  const worstDay = daily.length > 0 ? Math.min(...daily.map((d) => d.pnlUsd)) : null;

  return {
    totalTrades: all.length,
    closedTrades: closed.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate,
    netPnlUsd: netPnl,
    netR,
    expectancyR: closed.length > 0 ? netR / closed.length : null,
    avgWinR: mean(winRs),
    avgLossR: mean(lossRs),
    profitFactor,
    maxDrawdownR,
    maxDrawdownUsd,
    bestR: closed.length > 0 ? Math.max(...closed.map((t) => t.rMultiple ?? 0)) : null,
    worstR: closed.length > 0 ? Math.min(...closed.map((t) => t.rMultiple ?? 0)) : null,
    currentStreak,
    maxLossStreak,
    avgRiskPct: mean(all.map((t) => t.riskPct)),
    planAdherencePct: closed.length > 0 ? (adherence / closed.length) * 100 : null,
    tradingDays,
    avgTradesPerDay: tradingDays > 0 ? all.length / tradingDays : null,
    bestDayUsd: bestDay,
    worstDayUsd: worstDay,
    daily,
    equity,
    disciplineScore,
    disciplineParts,
  };
}
