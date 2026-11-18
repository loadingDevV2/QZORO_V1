import { computeRiskPlan, decideVerdict, validateGeometry } from "../risk";
import type {
  AnalysisRecord,
  DeskSettings,
  Guardrails,
  ProviderId,
  RawAnalysis,
  Verdict,
} from "../types";

export interface EnrichMeta {
  provider: ProviderId | "demo";
  model: string;
  demo: boolean;
  timeframe: string;
  session: string;
  notes: string;
  createdAt?: string;
}

function isGold(instrument: string): boolean {
  const normalized = instrument.toUpperCase().replace(/[^A-Z]/g, "");
  // Accept the usual spot-gold labels and broker suffixes (XAUUSD.m), but not
  // other XAU pairs such as XAUEUR: the desk prices XAUUSD only.
  return normalized === "GOLD" || normalized.startsWith("XAUUSD") || normalized.startsWith("GOLDUSD");
}

export function enrichAnalysis(
  raw: RawAnalysis,
  settings: DeskSettings,
  guardrails: Guardrails,
  meta: EnrichMeta,
): AnalysisRecord {
  const geometry = validateGeometry(raw);
  const deskInstrument = isGold(raw.instrument);
  // Do not quote a position size for a chart the desk will not review.
  const riskPlan = deskInstrument ? computeRiskPlan(raw, settings) : null;
  const decision: { verdict: Verdict; reasons: string[] } = deskInstrument
    ? decideVerdict(raw, riskPlan, guardrails, settings, geometry)
    : {
        verdict: "stood-down",
        reasons: [
          `The chart is labelled "${raw.instrument || "unknown"}". The desk only reviews XAUUSD.`,
        ],
      };

  const warnings = [...raw.warnings];
  if (/unknown/i.test(raw.timeframe)) {
    warnings.push("The chart timeframe was not legible. Treat the levels as provisional.");
  }
  if (raw.readQuality && raw.priceAxisReadable) {
    // readQuality is shown as context, not a warning.
  }
  if (raw.direction !== "none" && riskPlan && !riskPlan.ok && riskPlan.reason) {
    warnings.push(riskPlan.reason);
  }

  const stopDistance =
    riskPlan?.stopDistance ??
    (raw.entry != null && raw.stopLoss != null ? Math.abs(raw.entry - raw.stopLoss) : null);

  return {
    id: null,
    createdAt: meta.createdAt ?? new Date().toISOString(),
    provider: meta.provider,
    model: meta.model,
    demo: meta.demo,
    timeframe: meta.timeframe || raw.timeframe,
    session: meta.session,
    notes: meta.notes,
    imageUrl: null,
    raw: { ...raw, warnings: [...new Set(warnings)] },
    riskPlan,
    guardrails,
    verdict: decision.verdict,
    verdictReasons: [...new Set(decision.reasons.filter(Boolean))],
    rr1: riskPlan?.rr1 ?? null,
    rr2: riskPlan?.rr2 ?? null,
    stopDistance,
  };
}
