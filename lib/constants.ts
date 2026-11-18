import type { AccountRules, DeskSettings, InstrumentSpec, Models, ProviderId } from "./types";

export const PROVIDERS: ProviderId[] = ["gemini", "openai", "anthropic", "opencode"];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  opencode: "OpenCode Go",
};

export const PROVIDER_ENV: Record<ProviderId, string[]> = {
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  opencode: ["OPENCODE_GO_API_KEY", "OPENCODE_API_KEY"],
};

export const DEFAULT_MODELS: Models = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-6.1-terra",
  anthropic: "claude-sonnet-5-5",
  opencode: "deepseek-v4.1-flash",
};

export const MODEL_OPTIONS: Record<ProviderId, { id: string; label: string }[]> = {
  gemini: [
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash · frontier, free tier" },
    { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen · newest, free tier" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite · cheapest" },
  ],
  openai: [
    { id: "gpt-6.1-terra", label: "GPT-6.1 Terra · visual reasoning" },
    { id: "gpt-6-astra", label: "GPT-6 Astra · flagship" },
    { id: "gpt-6.1-sol", label: "GPT-6.1 Sol · balanced" },
    { id: "gpt-6-luna", label: "GPT-6 Luna · high volume" },
  ],
  anthropic: [
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 · balanced" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 · deepest reasoning" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 · fastest" },
  ],
  opencode: [
    { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash · vision, Go allowance" },
  ],
};

export const DEFAULT_ACCOUNT: AccountRules = {
  balance: 10000,
  currency: "USD",
  riskPerTradePct: 1,
  maxDailyLossPct: 2,
  maxWeeklyLossPct: 6,
  maxTradesPerDay: 2,
  maxConsecutiveLosses: 2,
  minRR: 2,
  minConfidence: 60,
};

export const DEFAULT_INSTRUMENT: InstrumentSpec = {
  symbol: "XAUUSD",
  contractSize: 100,
  spread: 0.3,
  commissionPerLot: 0,
};

export const DEFAULT_SETTINGS: DeskSettings = {
  provider: "gemini",
  models: { ...DEFAULT_MODELS },
  apiKeys: { gemini: "", openai: "", anthropic: "", opencode: "" },
  account: { ...DEFAULT_ACCOUNT },
  instrument: { ...DEFAULT_INSTRUMENT },
  updatedAt: new Date(0).toISOString(),
};

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;
export const SESSIONS = ["Asia", "London", "London / New York overlap", "New York", "After hours"] as const;

export const MIN_RR_OPTIONS = [1.5, 2, 2.5, 3];

export const DISCLAIMER =
  "QZORO is an analysis and record-keeping tool, not financial advice. Prices are read from a screenshot and can be wrong. You are responsible for every order you place.";

export const ACCOUNT_LIMITS = {
  balance: { min: 100, max: 10_000_000 },
  riskPerTradePct: { min: 0.1, max: 10 },
  maxDailyLossPct: { min: 0.5, max: 20 },
  maxWeeklyLossPct: { min: 1, max: 40 },
  maxTradesPerDay: { min: 1, max: 20 },
  maxConsecutiveLosses: { min: 1, max: 10 },
  minRR: { min: 1, max: 10 },
  minConfidence: { min: 0, max: 95 },
  spread: { min: 0, max: 20 },
  commissionPerLot: { min: 0, max: 500 },
  contractSize: { min: 1, max: 1000 },
} as const;

// Keep under Vercel's 4.5 MB request-body limit. The browser compresses before upload.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CHART_BUCKET = "charts";
