import { dateKey, floorTo, roundTo } from "./format";
import type { DeskSettings, Trade, TradeResult, TradeSource } from "./types";

const LOT_STEP = 0.01;

/** The only settings the deterministic trade math needs. Safe to use in the browser. */
export type DeskCostModel = Pick<DeskSettings, "account" | "instrument">;

export interface TradeDraft {
  tradeDate: string;
  direction: "long" | "short";
  setup: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  lots: number;
  result: TradeResult;
  exitPrice: number | null;
  notes: string;
  followedPlan: boolean;
  analysisId: string | null;
  source: TradeSource;
}

export interface TradeBuildResult {
  ok: boolean;
  error?: string;
  trade?: Omit<Trade, "id" | "createdAt">;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseTradeDraft(
  body: unknown,
  fallbackDate = dateKey(new Date()),
): TradeDraft | { error: string } {
  const input = (body ?? {}) as Record<string, unknown>;
  const direction = input.direction === "short" ? "short" : input.direction === "long" ? "long" : null;
  if (!direction) return { error: "Choose long or short." };

  const entry = num(input.entry);
  const stopLoss = num(input.stopLoss);
  const takeProfit = num(input.takeProfit);
  if (entry == null || entry <= 0) return { error: "Entry must be a positive price." };
  if (stopLoss == null || stopLoss <= 0) return { error: "Stop loss must be a positive price." };
  if (takeProfit == null || takeProfit <= 0) return { error: "Take profit must be a positive price." };

  if (direction === "long") {
    if (!(stopLoss < entry)) return { error: "For a long, the stop must sit below entry." };
    if (!(takeProfit > entry)) return { error: "For a long, the target must sit above entry." };
  } else {
    if (!(stopLoss > entry)) return { error: "For a short, the stop must sit above entry." };
    if (!(takeProfit < entry)) return { error: "For a short, the target must sit below entry." };
  }

  const lotsInput = num(input.lots);
  const result = (["open", "win", "loss", "breakeven"] as const).includes(input.result as TradeResult)
    ? (input.result as TradeResult)
    : "open";
  const exitPrice = num(input.exitPrice);
  const tradeDateRaw = str(input.tradeDate, 10);
  const tradeDate = isValidDateKey(tradeDateRaw) ? tradeDateRaw : fallbackDate;
  const source = (["manual", "analysis", "sample"] as const).includes(input.source as TradeSource)
    ? (input.source as TradeSource)
    : "manual";

  return {
    tradeDate,
    direction,
    setup: str(input.setup, 120),
    entry,
    stopLoss,
    takeProfit,
    lots: lotsInput ?? 0,
    result,
    exitPrice: exitPrice && exitPrice > 0 ? exitPrice : null,
    notes: str(input.notes, 2000),
    followedPlan: input.followedPlan !== false,
    analysisId: typeof input.analysisId === "string" && input.analysisId ? input.analysisId.slice(0, 80) : null,
    source,
  };
}

export function sizeLots(
  entry: number,
  stopLoss: number,
  settings: DeskCostModel,
): { lots: number; riskUsd: number; riskPct: number; perLotRisk: number } {
  const contract = settings.instrument.contractSize;
  const perLotRisk =
    Math.abs(entry - stopLoss) * contract +
    settings.instrument.spread * contract +
    settings.instrument.commissionPerLot;
  const target = (settings.account.balance * settings.account.riskPerTradePct) / 100;
  let lots = floorTo(target / perLotRisk, LOT_STEP);
  if (lots < LOT_STEP) lots = LOT_STEP;
  if (lots > 100) lots = 100;
  const riskUsd = roundTo(lots * perLotRisk, 0.01);
  return {
    lots,
    riskUsd,
    riskPct: roundTo((riskUsd / settings.account.balance) * 100, 0.01),
    perLotRisk,
  };
}

function executionCosts(lots: number, settings: DeskCostModel): number {
  return (
    settings.instrument.spread * settings.instrument.contractSize * lots +
    settings.instrument.commissionPerLot * lots
  );
}

export function buildTrade(draft: TradeDraft, settings: DeskCostModel): TradeBuildResult {
  if (draft.result === "open" && draft.exitPrice != null) {
    return { ok: false, error: "An open trade cannot have an exit price. Close it first." };
  }

  const sized = draft.lots > 0
    ? {
        lots: draft.lots,
        riskUsd:
          draft.lots *
          (Math.abs(draft.entry - draft.stopLoss) * settings.instrument.contractSize +
            settings.instrument.spread * settings.instrument.contractSize +
            settings.instrument.commissionPerLot),
        riskPct: 0,
        perLotRisk: 0,
      }
    : sizeLots(draft.entry, draft.stopLoss, settings);

  if (sized.lots < LOT_STEP) {
    return { ok: false, error: "This stop is too wide for the account's risk budget. Widen the account or tighten the stop." };
  }
  if (sized.lots > 100) {
    return { ok: false, error: "Position exceeds the 100-lot cap." };
  }

  const riskUsd = roundTo(sized.riskUsd, 0.01);
  const riskPct = roundTo((riskUsd / settings.account.balance) * 100, 0.01);
  const contract = settings.instrument.contractSize;
  const costs = roundTo(executionCosts(sized.lots, settings), 0.01);
  const rewardGross = Math.abs(draft.takeProfit - draft.entry) * contract * sized.lots;
  const plannedRr = riskUsd > 0 ? (rewardGross - costs) / riskUsd : 0;

  if (!(plannedRr > 0)) {
    return { ok: false, error: "The target does not cover execution costs. No trade." };
  }

  let pnlUsd: number | null = null;
  let rMultiple: number | null = null;
  let exitPrice: number | null = null;

  if (draft.result !== "open") {
    const dir = draft.direction === "long" ? 1 : -1;
    exitPrice =
      draft.exitPrice ??
      (draft.result === "win" ? draft.takeProfit : draft.result === "loss" ? draft.stopLoss : draft.entry);

    const move = (exitPrice - draft.entry) * dir;
    if (draft.result === "win" && move <= 0) {
      return { ok: false, error: "A winning exit must be on the profitable side of entry." };
    }
    if (draft.result === "loss" && move >= 0) {
      return { ok: false, error: "A losing exit must be on the losing side of entry." };
    }

    const gross = move * contract * sized.lots;
    pnlUsd = roundTo(gross - costs, 0.01);
    rMultiple = riskUsd > 0 ? roundTo(pnlUsd / riskUsd, 0.001) : null;
  }

  return {
    ok: true,
    trade: {
      tradeDate: draft.tradeDate,
      symbol: settings.instrument.symbol,
      direction: draft.direction,
      setup: draft.setup,
      entry: draft.entry,
      stopLoss: draft.stopLoss,
      takeProfit: draft.takeProfit,
      exitPrice,
      lots: sized.lots,
      riskUsd,
      riskPct,
      plannedRr: roundTo(plannedRr, 0.001),
      result: draft.result,
      rMultiple,
      pnlUsd,
      notes: draft.notes,
      analysisId: draft.analysisId,
      followedPlan: draft.followedPlan,
      source: draft.source,
    },
  };
}

export function applyTradeUpdate(
  existing: Trade,
  body: unknown,
  settings: DeskCostModel,
): TradeBuildResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const result = (["open", "win", "loss", "breakeven"] as const).includes(input.result as TradeResult)
    ? (input.result as TradeResult)
    : existing.result;

  let exitPrice: number | null = null;
  if (result !== "open") {
    exitPrice =
      input.exitPrice === undefined || input.exitPrice === null || input.exitPrice === ""
        ? existing.exitPrice
        : num(input.exitPrice);
  }

  const draft: TradeDraft = {
    tradeDate:
      typeof input.tradeDate === "string" && isValidDateKey(input.tradeDate)
        ? input.tradeDate
        : existing.tradeDate,
    direction: existing.direction,
    setup: typeof input.setup === "string" ? input.setup.trim().slice(0, 120) : existing.setup,
    entry: existing.entry,
    stopLoss: existing.stopLoss,
    takeProfit: existing.takeProfit,
    lots: existing.lots,
    result,
    exitPrice,
    notes: typeof input.notes === "string" ? input.notes.slice(0, 2000) : existing.notes,
    followedPlan: typeof input.followedPlan === "boolean" ? input.followedPlan : existing.followedPlan,
    analysisId: existing.analysisId,
    source: existing.source,
  };

  return buildTrade(draft, settings);
}
