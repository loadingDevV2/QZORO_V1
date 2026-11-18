import { PROVIDER_LABEL } from "../constants";
import type { ProviderId } from "../types";

export class ProviderError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "provider_error") {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
  }
}

export interface VisionCall {
  provider: ProviderId;
  model: string;
  apiKey: string;
  system: string;
  prompt: string;
  image?: { base64: string; mimeType: string };
  schema?: unknown;
  maxTokens?: number;
  sessionId?: string;
  /** Cap for this call. The deployment-wide provider timeout still applies. */
  timeoutMs?: number;
}

export interface ProviderReply {
  text: string;
  latencyMs: number;
}

export interface ProviderTestResult {
  ok: boolean;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  sample: string;
}

const configuredTimeout = Number(process.env.PROVIDER_TIMEOUT_MS ?? 55_000);
const DEFAULT_TIMEOUT =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 55_000;

function callTimeout(input: VisionCall): number {
  const requested = input.timeoutMs;
  if (typeof requested === "number" && Number.isFinite(requested) && requested > 0) {
    return Math.min(DEFAULT_TIMEOUT, Math.max(1_000, Math.floor(requested)));
  }
  return DEFAULT_TIMEOUT;
}

function trimBase(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; code?: number | string };
      message?: string;
    };
    const message = body?.error?.message ?? body?.message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 400);
  } catch {
    // Fall through to status text.
  }
  return response.statusText || "Unknown provider error";
}

function mapHttpError(provider: ProviderId, status: number, message: string): ProviderError {
  const label = PROVIDER_LABEL[provider];
  if (status === 400) {
    return new ProviderError(`${label} rejected the request: ${message}`, 400, "bad_request");
  }
  if (status === 401) {
    return new ProviderError(`${label} rejected the API key. Check the key in Settings.`, 401, "bad_key");
  }
  if (status === 403) {
    if (provider === "opencode") {
      return new ProviderError(
        `OpenCode Go refused this request. Check that the key belongs to a Go plan and that Global region is enabled for DeepSeek in the OpenCode Console privacy settings.${message ? ` (${message})` : ""}`,
        403,
        "forbidden",
      );
    }
    return new ProviderError(`${label} rejected the API key. Check the key in Settings.`, 401, "bad_key");
  }
  if (status === 404) {
    if (provider === "opencode") {
      return new ProviderError(
        "OpenCode Go does not expose that model. Use deepseek-v4.1-flash; the in-app Free variant cannot be called from outside OpenCode.",
        404,
        "bad_model",
      );
    }
    return new ProviderError(`${label}: that model is not available on this key. Check the model name.`, 404, "bad_model");
  }
  if (status === 413) {
    return new ProviderError("The chart image is too large for the provider. Re-upload a smaller screenshot.", 413, "image_too_large");
  }
  if (status === 429) {
    if (provider === "opencode") {
      return new ProviderError(
        `OpenCode Go rate limit or allowance reached. Free keys only work inside OpenCode; use a Go plan key.${message ? ` (${message})` : ""}`,
        429,
        "rate_limit",
      );
    }
    return new ProviderError(`${label} rate limit or quota reached. Wait a moment or switch provider in Settings.`, 429, "rate_limit");
  }
  if (status >= 500) {
    return new ProviderError(`${label} is unavailable right now (${status}). Try again in a minute.`, 502, "upstream");
  }
  return new ProviderError(`${label} error ${status}: ${message}`, 502, "provider_error");
}

async function geminiCall(input: VisionCall): Promise<string> {
  const base = trimBase(process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta");
  const url = `${base}/models/${encodeURIComponent(input.model)}:generateContent`;

  const parts: Record<string, unknown>[] = [];
  if (input.image) {
    parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
  }
  parts.push({ text: input.prompt });

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      maxOutputTokens: input.maxTokens ?? 4096,
      ...(input.schema
        ? { responseMimeType: "application/json", responseSchema: input.schema }
        : {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": input.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(callTimeout(input)),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ProviderError("Gemini took too long to answer. Try again or switch provider.", 504, "timeout");
    }
    throw new ProviderError("Could not reach Gemini. Check the internet connection.", 502, "network");
  }
  if (!response.ok) {
    throw mapHttpError("gemini", response.status, await readError(response));
  }

  const data = (await response.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini blocked the request (${data.promptFeedback.blockReason}).`, 422, "blocked");
  }
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new ProviderError(
      `Gemini returned an empty reply${candidate?.finishReason ? ` (${candidate.finishReason})` : ""}.`,
      502,
      "empty",
    );
  }
  return text;
}

interface OpenAICompatibleConfig {
  provider: ProviderId;
  base: string;
  tokenField: "max_tokens" | "max_completion_tokens";
  defaultMaxTokens: number;
  headers?: Record<string, string>;
}

async function openaiCompatibleCall(
  input: VisionCall,
  config: OpenAICompatibleConfig,
): Promise<string> {
  const label = PROVIDER_LABEL[config.provider];
  const content: Record<string, unknown>[] = [{ type: "text", text: input.prompt }];
  if (input.image) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${input.image.mimeType};base64,${input.image.base64}`,
        detail: "high",
      },
    });
  }

  let response: Response;
  try {
    response = await fetch(`${config.base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`,
        ...config.headers,
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        [config.tokenField]: input.maxTokens ?? config.defaultMaxTokens,
      }),
      signal: AbortSignal.timeout(callTimeout(input)),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ProviderError(`${label} took too long to answer. Try again or switch provider.`, 504, "timeout");
    }
    throw new ProviderError(`Could not reach ${label}. Check the internet connection.`, 502, "network");
  }
  if (!response.ok) {
    throw mapHttpError(config.provider, response.status, await readError(response));
  }

  const data = (await response.json()) as {
    choices?: {
      message?: { content?: string | null; refusal?: string | null };
      finish_reason?: string;
    }[];
  };
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) {
    throw new ProviderError(`${label} refused the request: ${choice.message.refusal}`, 422, "refused");
  }
  const contentText = choice?.message?.content ?? "";
  if (!contentText.trim()) {
    throw new ProviderError(
      `${label} returned an empty reply${choice?.finish_reason ? ` (${choice.finish_reason})` : ""}.`,
      502,
      "empty",
    );
  }
  return contentText;
}

function openaiCall(input: VisionCall): Promise<string> {
  return openaiCompatibleCall(input, {
    provider: "openai",
    base: trimBase(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
    tokenField: "max_completion_tokens",
    defaultMaxTokens: 4096,
  });
}

function opencodeBase(): string {
  return trimBase(
    process.env.OPENCODE_GO_BASE_URL ||
      process.env.OPENCODE_BASE_URL ||
      "https://opencode.ai/inference/go/openai/v1",
  );
}

function opencodeHeaders(input: VisionCall): Record<string, string> {
  return {
    "user-agent": process.env.OPENCODE_USER_AGENT || "qzoro/1.0",
    "x-opencode-session": input.sessionId ?? crypto.randomUUID(),
  };
}

function opencodeGoCall(input: VisionCall): Promise<string> {
  return openaiCompatibleCall(input, {
    provider: "opencode",
    base: opencodeBase(),
    tokenField: "max_tokens",
    defaultMaxTokens: 8192,
    headers: opencodeHeaders(input),
  });
}

async function anthropicCall(input: VisionCall): Promise<string> {
  const base = trimBase(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1");
  const content: Record<string, unknown>[] = [];
  if (input.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.image.mimeType,
        data: input.image.base64,
      },
    });
  }
  content.push({ type: "text", text: input.prompt });

  let response: Response;
  try {
    response = await fetch(`${base}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": process.env.ANTHROPIC_VERSION || "2026-10-21",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 4096,
        system: input.system,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(callTimeout(input)),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ProviderError("Claude took too long to answer. Try again or switch provider.", 504, "timeout");
    }
    throw new ProviderError("Could not reach Anthropic. Check the internet connection.", 502, "network");
  }
  if (!response.ok) {
    throw mapHttpError("anthropic", response.status, await readError(response));
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  if (data.stop_reason === "refusal") {
    throw new ProviderError("Claude refused the request.", 422, "refused");
  }
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  if (!text.trim()) {
    throw new ProviderError("Claude returned an empty reply.", 502, "empty");
  }
  return text;
}

export async function callVision(input: VisionCall): Promise<ProviderReply> {
  const started = Date.now();
  let text: string;
  if (input.provider === "gemini") text = await geminiCall(input);
  else if (input.provider === "openai") text = await openaiCall(input);
  else if (input.provider === "anthropic") text = await anthropicCall(input);
  else text = await opencodeGoCall(input);
  return { text, latencyMs: Date.now() - started };
}

async function testGemini(model: string, apiKey: string): Promise<string> {
  const base = trimBase(process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta");
  const response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with the single word READY." }] }],
      generationConfig: { maxOutputTokens: 64 },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw mapHttpError("gemini", response.status, await readError(response));
  const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function testOpenAI(model: string, apiKey: string): Promise<string> {
  const base = trimBase(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word READY." }],
      max_completion_tokens: 512,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw mapHttpError("openai", response.status, await readError(response));
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function testAnthropic(model: string, apiKey: string): Promise<string> {
  const base = trimBase(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1");
  const response = await fetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2026-10-21",
    },
    body: JSON.stringify({
      model,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with the single word READY." }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw mapHttpError("anthropic", response.status, await readError(response));
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

async function testOpenCode(model: string, apiKey: string): Promise<string> {
  const response = await fetch(`${opencodeBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "user-agent": process.env.OPENCODE_USER_AGENT || "qzoro/1.0",
      "x-opencode-session": crypto.randomUUID(),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word READY." }],
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw mapHttpError("opencode", response.status, await readError(response));
  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function testProvider(input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
}): Promise<ProviderTestResult> {
  const started = Date.now();
  let sample = "";
  if (input.provider === "gemini") sample = await testGemini(input.model, input.apiKey);
  else if (input.provider === "openai") sample = await testOpenAI(input.model, input.apiKey);
  else if (input.provider === "anthropic") sample = await testAnthropic(input.model, input.apiKey);
  else sample = await testOpenCode(input.model, input.apiKey);

  const latencyMs = Date.now() - started;
  if (!sample.trim()) {
    throw new ProviderError("The provider answered, but with an empty message. Check the model name.", 502, "empty");
  }
  return {
    ok: true,
    provider: input.provider,
    model: input.model,
    latencyMs,
    sample: sample.trim().slice(0, 80),
  };
}
