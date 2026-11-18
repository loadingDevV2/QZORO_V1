import { z } from "zod";
import type { RawAnalysis } from "../types";

const text = (max = 4000) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim().slice(0, max) : ""),
    z.string(),
  ).catch("");

const nullableNumber = z
  .preprocess((value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, z.number().finite().nullable())
  .catch(null);

const looseNumber = z
  .preprocess((value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value.replace(/[^0-9.-]/g, ""));
    return value;
  }, z.number().finite())
  .catch(0);

const levelArray = z
  .preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(looseNumber).transform((items) => items.filter((n) => n > 0).slice(0, 10)),
  )
  .catch([]);

const textArray = (maxItems: number, maxLength: number) =>
  z
    .preprocess(
      (value) => (Array.isArray(value) ? value : []),
      z
        .array(z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, maxLength) : ""), z.string()))
        .transform((items) => items.filter(Boolean).slice(0, maxItems)),
    )
    .catch([]);

const enums = {
  bias: z.enum(["bullish", "bearish", "neutral"]),
  setupStatus: z.enum(["ready", "waiting", "invalid"]),
  setupType: z.enum(["continuation", "reversal", "breakout", "range", "none"]),
  direction: z.enum(["long", "short", "none"]),
  entryType: z.enum(["market", "limit", "stop", "none"]),
};

function enumField<T extends z.ZodType>(schema: T, fallback: z.output<T>) {
  return z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      schema,
    )
    .catch(fallback);
}

const booleanField = z
  .preprocess((value) => {
    if (value === true || value === "true" || value === 1) return true;
    if (value === false || value === "false" || value === 0) return false;
    return value;
  }, z.boolean())
  .catch(false);

const confidence = z
  .preprocess((value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value.replace(/[^0-9.-]/g, ""));
    return 0;
  }, z.number().finite().catch(0))
  .transform((value) => Math.round(Math.min(100, Math.max(0, value))));

export const rawAnalysisSchema = z.object({
  instrument: text(40).transform((value) => value || "Unknown"),
  timeframe: text(20).transform((value) => value || "Unknown"),
  priceAxisReadable: booleanField,
  readQuality: text(600),
  bias: enumField(enums.bias, "neutral"),
  setupStatus: enumField(enums.setupStatus, "invalid"),
  setupName: text(160).transform((value) => value || "No qualified setup"),
  setupType: enumField(enums.setupType, "none"),
  direction: enumField(enums.direction, "none"),
  entryType: enumField(enums.entryType, "none"),
  entry: nullableNumber,
  stopLoss: nullableNumber,
  takeProfit1: nullableNumber,
  takeProfit2: nullableNumber,
  trigger: text(600),
  structure: text(1200),
  supports: levelArray,
  resistances: levelArray,
  confluences: textArray(6, 300),
  invalidation: text(600),
  management: text(600),
  warnings: textArray(6, 400),
  reasoning: text(1800),
  confidence,
  noTradeReason: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().slice(0, 600) : null),
      z.string().nullable(),
    )
    .catch(null),
});

export type ParsedRawAnalysis = z.output<typeof rawAnalysisSchema>;

export function extractJson(textValue: string): unknown | null {
  let clean = textValue.trim();
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) clean = fenced[1].trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseRawAnalysis(
  textValue: string,
): { ok: true; raw: RawAnalysis } | { ok: false; error: string } {
  const json = extractJson(textValue);
  if (!json) return { ok: false, error: "The reply did not contain a JSON object." };
  const parsed = rawAnalysisSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: issues };
  }
  return { ok: true, raw: parsed.data as RawAnalysis };
}

/**
 * JSON Schema handed to Gemini as a native response schema and printed for the
 * other providers. Keep it flat and free of unsupported keywords.
 */
export const GEMINI_SCHEMA = {
  type: "object",
  properties: {
    instrument: { type: "string", description: "Instrument label exactly as shown on the chart, e.g. XAUUSD." },
    timeframe: { type: "string", description: "Chart timeframe as shown, e.g. M15, H1, H4. 'Unknown' if absent." },
    priceAxisReadable: { type: "boolean", description: "True only if enough price-axis labels are legible to quote levels." },
    readQuality: { type: "string", description: "One sentence on screenshot legibility and any obscured areas." },
    bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
    setupStatus: { type: "string", enum: ["ready", "waiting", "invalid"] },
    setupName: { type: "string" },
    setupType: { type: "string", enum: ["continuation", "reversal", "breakout", "range", "none"] },
    direction: { type: "string", enum: ["long", "short", "none"], description: "Trade direction. Use 'none' when no trade is justified." },
    entryType: { type: "string", enum: ["market", "limit", "stop", "none"] },
    entry: { type: "number", nullable: true },
    stopLoss: { type: "number", nullable: true },
    takeProfit1: { type: "number", nullable: true },
    takeProfit2: { type: "number", nullable: true },
    trigger: { type: "string", description: "Exact activation condition and invalidation before entry." },
    structure: { type: "string", description: "Market structure and momentum read." },
    supports: { type: "array", items: { type: "number" } },
    resistances: { type: "array", items: { type: "number" } },
    confluences: { type: "array", items: { type: "string" } },
    invalidation: { type: "string" },
    management: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
    confidence: { type: "integer", description: "Calibrated 0-100. 80+ only for A+ confluence; under 55 means stand down." },
    noTradeReason: { type: "string", nullable: true },
  },
  required: [
    "instrument",
    "timeframe",
    "priceAxisReadable",
    "readQuality",
    "bias",
    "setupStatus",
    "setupName",
    "setupType",
    "direction",
    "entryType",
    "entry",
    "stopLoss",
    "takeProfit1",
    "takeProfit2",
    "trigger",
    "structure",
    "supports",
    "resistances",
    "confluences",
    "invalidation",
    "management",
    "warnings",
    "reasoning",
    "confidence",
    "noTradeReason",
  ],
} as const;
