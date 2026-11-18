import type { AnalysisRecord, DeskSettings, Guardrails, RawAnalysis } from "../types";
import { enrichAnalysis } from "./enrich";

const SAMPLE: RawAnalysis = {
  instrument: "XAUUSD",
  timeframe: "M15",
  priceAxisReadable: true,
  readQuality:
    "Clean 15-minute chart. Instrument and price axis legible; no spread or indicator legend visible.",
  bias: "bullish",
  setupStatus: "ready",
  setupName: "Breakout–retest of the Asian range high",
  setupType: "continuation",
  direction: "long",
  entryType: "limit",
  entry: 4181.5,
  stopLoss: 4172.8,
  takeProfit1: 4203.0,
  takeProfit2: 4216.0,
  trigger:
    "Wait for an M15 close above 4186.00, then bid a retest into 4181.50–4183.00. The order is cancelled if price closes back below 4177.00 before the retest fills.",
  structure:
    "Higher highs and higher lows since the London open. The prior day high at 4196.00 is the next liquidity shelf, with the 4200 round number just above it. Momentum is steady rather than climactic, and the range high held three tests overnight — a clean pool of stops sits above it.",
  supports: [4177.0, 4172.8, 4163.5],
  resistances: [4186.0, 4196.0, 4203.0, 4216.0],
  confluences: [
    "Break of the Asian range high with a higher-low structure intact",
    "Retest lands on the 4181–4183 fair value gap left by the breakout candle",
    "Prior day high at 4196.00 gives TP1 a visible liquidity target",
    "4200 round number sits beyond TP1 as an extension magnet",
    "Pullback entry keeps the stop behind the 4177.00 range shelf",
  ],
  invalidation:
    "Two consecutive M15 closes back inside the range below 4177.00. The breakout has failed and the level is no longer a retest.",
  management:
    "Take half at TP1 and move the stop to breakeven only after that fill. Trail the remainder under the last higher low. Do not add to the position and do not widen the stop.",
  warnings: [
    "Illustrative worked example — these are sample levels, not a live market read.",
    "US CPI is due inside this session. The desk would normally wait for the print before holding a breakout.",
    "The entry is a limit order. If price runs without the retest, there is no trade.",
  ],
  reasoning:
    "The structure is bullish and the breakout level has been tested enough to make a retest plausible. The trade only pays if the pullback holds above the range shelf; a close back inside the range kills the idea. Location and invalidation are clear, so the plan is worth pricing, but the news risk means size stays at the desk minimum.",
  confidence: 74,
  noTradeReason: null,
};

export function buildDemoAnalysis(
  settings: DeskSettings,
  guardrails: Guardrails,
  session = "London",
): AnalysisRecord {
  return enrichAnalysis(SAMPLE, settings, guardrails, {
    provider: "demo",
    model: "sample-desk",
    demo: true,
    timeframe: "M15",
    session,
    notes: "Worked example. Levels are illustrative and must not be traded.",
  });
}
