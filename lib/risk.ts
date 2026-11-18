import { deskDateKey, deskWeekStartKeyFromDateKey } from "./desk-time";
import { fmtUsd, floorTo } from "./format";
import type {
  DeskSettings,
  Guardrails,
  RawAnalysis,
  RiskPlan,
  Trade,
} from "./types";

const LOT_STEP = 0.01;

export function riskPerTradeUsd(settings: DeskSettings): number {
  return (settings.account.balance * settings.account.riskPerTradePct) / 100;
}

export function dailyLossLimitUsd(settings: DeskSettings): number {
  return (settings.account.balance * settings.account.maxDailyLossPct) / 100;
}

export function weeklyLossLimitUsd(settings: DeskSettings): number {
  return (settings.account.balance * settings.account.maxWeeklyLossPct) / 100;
}

/**
 * Deterministic position sizing for XAUUSD.
 * Costs are charged on both sides so the plan is conservative, never optimistic.
 */
export function computeRiskPlan(raw: RawAnalysis, settings: DeskSettings): RiskPlan | null {
  const { entry, stopLoss, takeProfit1, takeProfit2, direction } = raw;
  if (direction === "none" || entry == null || stopLoss == null) return null;

  const contract = settings.instrument.contractSize;
  const spread = Math.max(0, settings.instrument.spread);
  const commissionPerLot = Math.max(0, settings.instrument.commissionPerLot);
  const targetRisk = riskPerTradeUsd(settings);
  const stopDistance = Math.abs(entry - stopLoss);
  const warnings: string[] = [];

  if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
    return {
      ok: false,
      reason: "Entry and stop loss are the same price — the plan cannot be sized.",
      stopDistance: 0,
      stopPips: 0,
      lots: 0,
      unitsOz: 0,
      notionalUsd: 0,
      riskUsd: 0,
      riskPct: 0,
      targetRiskPct: settings.account.riskPerTradePct,
      commissionUsd: 0,
      spreadCostUsd: 0,
      lossAtStopUsd: 0,
      profitTp1Usd: null,
      profitTp2Usd: null,
      rr1: null,
      rr2: null,
      warnings,
    };
  }

  const costPerLot = spread * contract + commissionPerLot;
  const lossPerLot = stopDistance * contract + costPerLot;
  const rawLots = targetRisk / lossPerLot;
  let lots = floorTo(rawLots, LOT_STEP);
  let ok = true;
  let reason: string | null = null;

  if (lots < LOT_STEP) {
    lots = LOT_STEP;
    ok = false;
    reason = `Minimum 0.01 lot risks ${fmtUsd(lots * lossPerLot)} — above your ${fmtUsd(targetRisk)} budget. Wider stop than the account can carry.`;
  }

  if (lots > 100) {
    lots = 100;
    ok = false;
    reason = "Sizing exceeds the 100-lot cap. Check the price read before trading this.";
  }

  const actualRisk = lots * lossPerLot;
  const riskPct = (actualRisk / settings.account.balance) * 100;

  if (riskPct > settings.account.riskPerTradePct * 1.02) {
    warnings.push(`Sized risk is ${riskPct.toFixed(2)}% of the account, above the ${settings.account.riskPerTradePct}% mandate.`);
  }
  if (stopDistance < 1) warnings.push("Stop is under $1.00 from entry — inside typical XAUUSD noise.");
  if (stopDistance > 60) warnings.push("Stop is over $60.00 wide — verify the price axis before sizing this.");

  const distanceToTp = (tp: number | null) =>
    tp == null ? null : Math.abs(tp - entry);

  const netProfit = (distance: number | null) => {
    if (distance == null) return null;
    return distance * contract * lots - costPerLot * lots;
  };

  const tp1Distance = distanceToTp(takeProfit1);
  const tp2Distance = distanceToTp(takeProfit2);
  const profitTp1 = netProfit(tp1Distance);
  const profitTp2 = netProfit(tp2Distance);

  const rr1 = profitTp1 != null ? profitTp1 / actualRisk : null;
  const rr2 = profitTp2 != null ? profitTp2 / actualRisk : null;

  if (rr1 != null && rr1 < settings.account.minRR) {
    warnings.push(`TP1 is ${rr1.toFixed(2)}R net — below the ${settings.account.minRR}R desk minimum.`);
  }

  return {
    ok,
    reason,
    stopDistance,
    stopPips: stopDistance / 0.1,
    lots,
    unitsOz: lots * contract,
    notionalUsd: lots * contract * entry,
    riskUsd: actualRisk,
    riskPct,
    targetRiskPct: settings.account.riskPerTradePct,
    commissionUsd: lots * commissionPerLot,
    spreadCostUsd: lots * spread * contract,
    lossAtStopUsd: actualRisk,
    profitTp1Usd: profitTp1,
    profitTp2Usd: profitTp2,
    rr1,
    rr2,
    warnings,
  };
}

export function computeGuardrails(
  trades: Trade[],
  settings: DeskSettings,
  today = deskDateKey(),
): Guardrails {
  const dailyLimit = dailyLossLimitUsd(settings);
  const weeklyLimit = weeklyLossLimitUsd(settings);
  const weekStart = deskWeekStartKeyFromDateKey(today);

  const todayTrades = trades.filter((t) => t.tradeDate === today);
  const todayClosed = todayTrades.filter((t) => t.result !== "open");
  const realizedToday = todayClosed.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const realizedTodayR = todayClosed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const weeklyRealized = trades
    .filter((t) => t.tradeDate >= weekStart && t.tradeDate <= today && t.result !== "open")
    .reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);

  const openTrades = trades.filter((t) => t.result === "open");
  const openRisk = openTrades.reduce((sum, t) => sum + t.riskUsd, 0);

  const closedChronological = [...trades]
    .filter((t) => t.result !== "open")
    .sort((a, b) => (a.tradeDate + a.createdAt).localeCompare(b.tradeDate + b.createdAt));

  let lossStreak = 0;
  for (let i = closedChronological.length - 1; i >= 0; i -= 1) {
    const trade = closedChronological[i];
    if (trade.result === "loss") lossStreak += 1;
    else break;
  }

  const locked: string[] = [];
  if (realizedToday <= -dailyLimit) {
    locked.push(`Daily loss limit reached (${fmtUsd(Math.abs(realizedToday))} of ${fmtUsd(dailyLimit)}).`);
  }
  if (weeklyRealized <= -weeklyLimit) {
    locked.push(`Weekly loss limit reached (${fmtUsd(Math.abs(weeklyRealized))} of ${fmtUsd(weeklyLimit)}).`);
  }
  if (todayTrades.length >= settings.account.maxTradesPerDay) {
    locked.push(`Trade count cap reached (${todayTrades.length} of ${settings.account.maxTradesPerDay}).`);
  }
  if (lossStreak >= settings.account.maxConsecutiveLosses) {
    locked.push(`${lossStreak} losses in a row — the desk stops at ${settings.account.maxConsecutiveLosses}.`);
  }
  if (openRisk > dailyLimit * 0.75) {
    locked.push(`Open risk ${fmtUsd(openRisk)} is over 75% of the daily loss budget.`);
  }

  const caution: string[] = [];
  if (realizedToday < 0 && realizedToday > -dailyLimit) {
    caution.push(`Down ${fmtUsd(Math.abs(realizedToday))} today. Half the loss budget is gone at ${fmtUsd(dailyLimit / 2)}.`);
  }
  if (todayTrades.length === settings.account.maxTradesPerDay - 1) {
    caution.push("One trade left in the daily cap after this one.");
  }
  if (lossStreak === settings.account.maxConsecutiveLosses - 1) {
    caution.push("One more loss triggers the desk stop.");
  }
  if (weeklyRealized < 0 && weeklyRealized > -weeklyLimit) {
    caution.push(`${fmtUsd(Math.abs(weeklyRealized))} given back this week.`);
  }

  const status = locked.length > 0 ? "locked" : caution.length > 0 ? "caution" : "clear";

  return {
    status,
    reasons: locked.length > 0 ? locked : caution,
    asOf: today,
    tradesToday: todayTrades.length,
    maxTradesPerDay: settings.account.maxTradesPerDay,
    tradesRemaining: Math.max(0, settings.account.maxTradesPerDay - todayTrades.length),
    realizedTodayUsd: realizedToday,
    realizedTodayR,
    dailyLossLimitUsd: dailyLimit,
    dailyRemainingUsd: Math.max(0, dailyLimit + Math.min(0, realizedToday)),
    weeklyRealizedUsd: weeklyRealized,
    weeklyLossLimitUsd: weeklyLimit,
    openTrades: openTrades.length,
    openRiskUsd: openRisk,
    lossStreak,
    maxConsecutiveLosses: settings.account.maxConsecutiveLosses,
    balance: settings.account.balance,
    riskPerTradeUsd: riskPerTradeUsd(settings),
  };
}

export interface GeometryIssue {
  field: string;
  message: string;
}

export function validateGeometry(raw: RawAnalysis): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const { direction, entry, stopLoss, takeProfit1, takeProfit2 } = raw;

  if (direction === "none") return issues;

  if (entry == null) issues.push({ field: "entry", message: "No entry level was returned." });
  if (stopLoss == null) issues.push({ field: "stopLoss", message: "No stop loss was returned." });
  if (takeProfit1 == null) issues.push({ field: "takeProfit1", message: "No first target was returned." });

  if (entry == null || stopLoss == null) return issues;

  if (direction === "long") {
    if (stopLoss >= entry) issues.push({ field: "stopLoss", message: "For a long, the stop must sit below entry." });
    if (takeProfit1 != null && takeProfit1 <= entry) issues.push({ field: "takeProfit1", message: "For a long, TP1 must sit above entry." });
    if (takeProfit2 != null && takeProfit1 != null && takeProfit2 < takeProfit1) issues.push({ field: "takeProfit2", message: "TP2 must not sit below TP1." });
  } else if (direction === "short") {
    if (stopLoss <= entry) issues.push({ field: "stopLoss", message: "For a short, the stop must sit above entry." });
    if (takeProfit1 != null && takeProfit1 >= entry) issues.push({ field: "takeProfit1", message: "For a short, TP1 must sit below entry." });
    if (takeProfit2 != null && takeProfit1 != null && takeProfit2 > takeProfit1) issues.push({ field: "takeProfit2", message: "TP2 must not sit above TP1." });
  } else {
    issues.push({ field: "direction", message: "Direction is not long, short, or none." });
  }

  const distance = Math.abs(entry - stopLoss);
  if (distance > 0 && distance < 0.2) {
    issues.push({ field: "stopLoss", message: "Stop is under $0.20 away — too tight to be a structural invalidation." });
  }
  if (distance > 150) {
    issues.push({ field: "stopLoss", message: "Stop is over $150 away — likely a misread price." });
  }

  return issues;
}

export function decideVerdict(
  raw: RawAnalysis,
  riskPlan: RiskPlan | null,
  guardrails: Guardrails,
  settings: DeskSettings,
  geometryIssues: GeometryIssue[],
): { verdict: "cleared" | "wait" | "stood-down"; reasons: string[] } {
  const reasons: string[] = [];

  if (!raw.priceAxisReadable) {
    return { verdict: "stood-down", reasons: ["The price axis could not be read. The desk will not quote levels from an unreadable chart."] };
  }
  if (raw.direction === "none" || raw.setupStatus === "invalid") {
    reasons.push(raw.noTradeReason?.trim() || "No trade is justified on this chart.");
    return { verdict: "stood-down", reasons };
  }
  if (geometryIssues.length > 0) {
    return {
      verdict: "stood-down",
      reasons: geometryIssues.map((issue) => issue.message),
    };
  }
  if (!riskPlan) {
    return { verdict: "stood-down", reasons: ["The risk plan could not be computed. No position size, no trade."] };
  }
  if (!riskPlan.ok) {
    return { verdict: "stood-down", reasons: [riskPlan.reason ?? "Position size is not viable."] };
  }
  if (riskPlan.rr1 != null && riskPlan.rr1 < settings.account.minRR) {
    return {
      verdict: "stood-down",
      reasons: [`TP1 pays ${riskPlan.rr1.toFixed(2)}R after costs. The desk minimum is ${settings.account.minRR}R.`],
    };
  }
  if (raw.confidence < settings.account.minConfidence) {
    return {
      verdict: "stood-down",
      reasons: [`Confidence ${raw.confidence}/100 is below the ${settings.account.minConfidence} floor.`],
    };
  }
  if (guardrails.status === "locked") {
    return { verdict: "stood-down", reasons: guardrails.reasons };
  }

  reasons.push(...riskPlan.warnings);
  if (guardrails.status === "caution") reasons.push(...guardrails.reasons);

  return {
    verdict: raw.setupStatus === "waiting" ? "wait" : "cleared",
    reasons,
  };
}
