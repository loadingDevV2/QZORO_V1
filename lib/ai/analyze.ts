import { PROVIDER_LABEL } from "../constants";
import { resolveApiKey } from "../settings-service";
import type { AnalysisRequestContext, DeskSettings, ProviderId, RawAnalysis } from "../types";
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt";
import { callVision, ProviderError } from "./providers";
import { GEMINI_SCHEMA, parseRawAnalysis } from "./schema";

const configuredBudget = Number(process.env.ANALYSIS_BUDGET_MS ?? 50_000);
const ANALYSIS_BUDGET_MS =
  Number.isFinite(configuredBudget) && configuredBudget > 0 ? configuredBudget : 50_000;
const MIN_REPAIR_MS = 12_000;

export class AnalysisError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "analysis_failed", status = 502) {
    super(message);
    this.name = "AnalysisError";
    this.code = code;
    this.status = status;
  }
}

export interface AnalysisOutcome {
  raw: RawAnalysis;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  repaired: boolean;
}

export async function runAnalysis(input: {
  imageBase64: string;
  mimeType: string;
  context: AnalysisRequestContext;
  settings: DeskSettings;
}): Promise<AnalysisOutcome> {
  const provider = input.settings.provider;
  const model = input.settings.models[provider];
  const resolved = resolveApiKey(provider, input.settings);

  if (!resolved.key) {
    throw new AnalysisError(
      `No ${PROVIDER_LABEL[provider]} API key is configured. Add one in Settings, or run the sample review.`,
      "no_key",
      400,
    );
  }

  const system = buildSystemPrompt(input.settings);
  const prompt = buildUserPrompt(input.context, input.settings);
  const sessionId = crypto.randomUUID();
  const deadline = Date.now() + ANALYSIS_BUDGET_MS;

  let reply;
  try {
    reply = await callVision({
      provider,
      model,
      apiKey: resolved.key,
      system,
      prompt,
      image: { base64: input.imageBase64, mimeType: input.mimeType },
      schema: GEMINI_SCHEMA,
      sessionId,
      timeoutMs: Math.max(1_000, deadline - Date.now() - 2_000),
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      throw new AnalysisError(error.message, error.code, error.status);
    }
    throw new AnalysisError("The provider call failed before an answer was returned.", "provider_error", 502);
  }

  const first = parseRawAnalysis(reply.text);
  if (first.ok) {
    return { raw: first.raw, provider, model, latencyMs: reply.latencyMs, repaired: false };
  }

  // One repair pass. The image is not resent: the model only has to fix
  // structure. Skip it when the first call used most of the request budget,
  // otherwise Vercel would kill the function before the repair could finish.
  const remainingMs = deadline - Date.now();
  if (remainingMs < MIN_REPAIR_MS) {
    throw new AnalysisError(
      `The model returned structure the desk could not accept (${first.error}), and the request was too close to its time limit to repair it. Try again or use a faster provider.`,
      "invalid_json",
      422,
    );
  }

  try {
    const repaired = await callVision({
      provider,
      model,
      apiKey: resolved.key,
      system: "You repair malformed JSON for a trading desk. Return one valid JSON object only, with no commentary or markdown.",
      prompt: buildRepairPrompt(reply.text, first.error),
      schema: GEMINI_SCHEMA,
      maxTokens: 4096,
      sessionId,
      timeoutMs: Math.max(1_000, remainingMs - 2_000),
    });
    const second = parseRawAnalysis(repaired.text);
    if (second.ok) {
      return {
        raw: second.raw,
        provider,
        model,
        latencyMs: reply.latencyMs + repaired.latencyMs,
        repaired: true,
      };
    }
    throw new AnalysisError(
      `The model returned structure the desk could not accept (${second.error}). Try a cleaner screenshot or another provider.`,
      "invalid_json",
      422,
    );
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (error instanceof ProviderError) {
      throw new AnalysisError(error.message, error.code, error.status);
    }
    throw new AnalysisError(
      "The model returned structure the desk could not accept. Try a cleaner screenshot or another provider.",
      "invalid_json",
      422,
    );
  }
}
