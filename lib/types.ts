export type ProviderId = "gemini" | "openai" | "anthropic" | "opencode";
export type Direction = "long" | "short" | "none";
export type Bias = "bullish" | "bearish" | "neutral";
export type SetupStatus = "ready" | "waiting" | "invalid";
export type SetupType = "continuation" | "reversal" | "breakout" | "range" | "none";
export type EntryType = "market" | "limit" | "stop" | "none";
export type Verdict = "cleared" | "wait" | "stood-down";
export type TradeResult = "open" | "win" | "loss" | "breakeven";
export type TradeSource = "manual" | "analysis" | "sample";
export type KeySource = "stored" | "env" | "none";

export type Models = Record<ProviderId, string>;
export type ApiKeys = Record<ProviderId, string>;

export interface AccountRules {
  balance: number;
  currency: "USD";
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxTradesPerDay: number;
  maxConsecutiveLosses: number;
  minRR: number;
  minConfidence: number;
}

export interface InstrumentSpec {
  symbol: string;
  contractSize: number;
  spread: number;
  commissionPerLot: number;
}

export interface DeskSettings {
  provider: ProviderId;
  models: Models;
  apiKeys: ApiKeys;
  account: AccountRules;
  instrument: InstrumentSpec;
  updatedAt: string;
}

export interface KeyStatus {
  hasKey: boolean;
  hint: string;
  source: KeySource;
}

export type ClientSettings = Omit<DeskSettings, "apiKeys"> & {
  keys: Record<ProviderId, KeyStatus>;
};

export interface Trade {
  id: string;
  createdAt: string;
  tradeDate: string;
  symbol: string;
  direction: "long" | "short";
  setup: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  lots: number;
  riskUsd: number;
  riskPct: number;
  plannedRr: number;
  result: TradeResult;
  rMultiple: number | null;
  pnlUsd: number | null;
  notes: string;
  analysisId: string | null;
  followedPlan: boolean;
  source: TradeSource;
}

export interface RawAnalysis {
  instrument: string;
  timeframe: string;
  priceAxisReadable: boolean;
  readQuality: string;
  bias: Bias;
  setupStatus: SetupStatus;
  setupName: string;
  setupType: SetupType;
  direction: Direction;
  entryType: EntryType;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  trigger: string;
  structure: string;
  supports: number[];
  resistances: number[];
  confluences: string[];
  invalidation: string;
  management: string;
  warnings: string[];
  reasoning: string;
  confidence: number;
  noTradeReason: string | null;
}

export interface RiskPlan {
  ok: boolean;
  reason: string | null;
  stopDistance: number;
  stopPips: number;
  lots: number;
  unitsOz: number;
  notionalUsd: number;
  riskUsd: number;
  riskPct: number;
  targetRiskPct: number;
  commissionUsd: number;
  spreadCostUsd: number;
  lossAtStopUsd: number;
  profitTp1Usd: number | null;
  profitTp2Usd: number | null;
  rr1: number | null;
  rr2: number | null;
  warnings: string[];
}

export interface Guardrails {
  status: "clear" | "caution" | "locked";
  reasons: string[];
  asOf: string;
  tradesToday: number;
  maxTradesPerDay: number;
  tradesRemaining: number;
  realizedTodayUsd: number;
  realizedTodayR: number;
  dailyLossLimitUsd: number;
  dailyRemainingUsd: number;
  weeklyRealizedUsd: number;
  weeklyLossLimitUsd: number;
  openTrades: number;
  openRiskUsd: number;
  lossStreak: number;
  maxConsecutiveLosses: number;
  balance: number;
  riskPerTradeUsd: number;
}

export interface AnalysisRecord {
  id: string | null;
  createdAt: string;
  provider: ProviderId | "demo";
  model: string;
  demo: boolean;
  timeframe: string;
  session: string;
  notes: string;
  imageUrl: string | null;
  raw: RawAnalysis;
  riskPlan: RiskPlan | null;
  guardrails: Guardrails;
  verdict: Verdict;
  verdictReasons: string[];
  rr1: number | null;
  rr2: number | null;
  stopDistance: number | null;
}

export interface AnalysisSummary {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  demo: boolean;
  timeframe: string;
  verdict: Verdict;
  direction: Direction;
  setupName: string;
  confidence: number;
  imageUrl: string | null;
}

export interface DailyStat {
  date: string;
  pnlUsd: number;
  r: number;
  trades: number;
}

export interface EquityPoint {
  date: string;
  label: string;
  cumulativeR: number;
  cumulativeUsd: number;
}

export interface DisciplinePart {
  key: string;
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface Stats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  netPnlUsd: number;
  netR: number;
  expectancyR: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number;
  maxDrawdownUsd: number;
  bestR: number | null;
  worstR: number | null;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  maxLossStreak: number;
  avgRiskPct: number | null;
  planAdherencePct: number | null;
  tradingDays: number;
  avgTradesPerDay: number | null;
  bestDayUsd: number | null;
  worstDayUsd: number | null;
  daily: DailyStat[];
  equity: EquityPoint[];
  disciplineScore: number | null;
  disciplineParts: DisciplinePart[];
}

export interface AnalysisRequestContext {
  timeframe: string;
  session: string;
  highImpactNews: boolean;
  notes: string;
}
