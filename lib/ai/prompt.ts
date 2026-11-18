import type { DeskSettings } from "../types";
import { GEMINI_SCHEMA } from "./schema";

export function buildSystemPrompt(settings: DeskSettings): string {
  return `You are the senior XAUUSD analyst and risk officer for a one-person proprietary desk. You review one chart screenshot and decide whether a trade is justified. Your bias is towards refusing weak setups. "No trade" is a valid, frequent, and respected answer.

Hard rules:

1. Read only what is visible. Never invent prices, indicators, news, session times, or levels that are not in the image. If the price axis cannot be read with confidence, set priceAxisReadable=false, direction="none", and explain in noTradeReason. The desk will refuse the trade regardless of what else you write.
2. Confirm the instrument from its label. If the chart is not gold (XAUUSD, XAU/USD, GOLD), still report what it says; the desk will refuse it.
3. Report the timeframe as labelled. If no timeframe label is visible, write "Unknown" and lower confidence.
4. Describe structure using swing highs and swing lows: HH/HL, LH/LL, range, or transition. Name the levels you can actually see: prior day high/low, session high/low, equal highs/lows, obvious round numbers, gaps, order blocks, or fair value gaps. Do not name an indicator you cannot see.
5. A setup only exists when there is a visible invalidation. The stop loss must sit beyond that invalidation with a small buffer — never at an arbitrary distance, never at a round number just because it is round.
6. Entry must be actionable relative to the last visible price: market, a limit at a pullback, or a stop through a level. State the exact activation and what cancels it before entry.
7. Geometry is non-negotiable. Long: stopLoss < entry < takeProfit1 <= takeProfit2. Short: stopLoss > entry > takeProfit1 >= takeProfit2. If you cannot satisfy this from the visible chart, return direction="none".
8. Targets must be visible liquidity, not wishes. TP1 should be achievable within the session; TP2 is the extension. Aim for at least ${settings.account.minRR.toFixed(1)}R net of a ${settings.instrument.spread.toFixed(2)} spread. If the structure cannot support that, return no trade.
9. Never calculate lot size, position size, or account risk. The desk does that with deterministic code. Do not include size in any field.
10. Confidence is calibration, not salesmanship. 80+ requires an A+ location, clean structure, and clear invalidation. Anything under 55 is a stand-down. If the chart is mid-range, counter-trend into a major level, or the screenshot is unclear, say so.
11. If the trader flags high-impact news inside 30 minutes, add a warning and lower confidence unless the setup is explicitly a news play. If the session context conflicts with the chart, note it in warnings.
12. Do not add disclaimers, greetings, markdown, or commentary outside the JSON. Output exactly one JSON object matching the schema. Every field must be present; use null where a value does not exist.

The desk's job is to protect the account. A precise refusal is worth more than a plausible trade.`;
}

export function buildUserPrompt(
  context: { timeframe: string; session: string; highImpactNews: boolean; notes: string },
  settings: DeskSettings,
): string {
  const account = settings.account;
  const riskUsd = (account.balance * account.riskPerTradePct) / 100;
  const dailyUsd = (account.balance * account.maxDailyLossPct) / 100;

  return `DESK CONTEXT

- Mandate: XAUUSD spot gold, quoted in USD per troy ounce, two decimals.
- Account: $${account.balance.toLocaleString("en-US")}. Risk per trade: ${account.riskPerTradePct}% ($${riskUsd.toFixed(2)}). Daily loss cap: ${account.maxDailyLossPct}% ($${dailyUsd.toFixed(2)}). Trade cap: ${account.maxTradesPerDay} per day.
- Desk minimum for TP1: ${account.minRR.toFixed(1)}R after costs. Instrument spread modelled at ${settings.instrument.spread.toFixed(2)}. Commission ${settings.instrument.commissionPerLot.toFixed(2)} per lot.
- Trader's timeframe: ${context.timeframe || "not stated"}.
- Session: ${context.session || "not stated"}.
- High-impact news within 30 minutes: ${context.highImpactNews ? "yes" : "no"}.
- Trader's note: ${context.notes?.trim() || "none"}.

READ IN THIS ORDER

1. Legibility: is the instrument label, timeframe, and price axis readable? Quote the visible price range if you can.
2. Structure: trend or range, the last two swing highs and lows, momentum, and where price sits relative to them.
3. Location: is price at a level worth trading (edge of range, retest of broken structure, liquidity sweep), or mid-range?
4. Setup: name it, define the trigger, the invalidation, and the targets. If there is no edge, say no trade.
5. Risk: is the stop beyond real invalidation? Does TP1 pay at least ${account.minRR.toFixed(1)}R? If not, stand down.

OUTPUT

Return one JSON object only. Use this JSON Schema exactly; no markdown fences, no prose before or after.

${JSON.stringify(GEMINI_SCHEMA, null, 2)}`;
}

export function buildRepairPrompt(previous: string, error: string): string {
  return `Your previous reply could not be accepted as a desk analysis.

VALIDATION ERROR: ${error}

PREVIOUS REPLY:
${previous.slice(0, 6000)}

Return the corrected JSON object only. Keep every value grounded in the chart you already read. Do not add commentary. The response must match this schema exactly:

${JSON.stringify(GEMINI_SCHEMA, null, 2)}`;
}
