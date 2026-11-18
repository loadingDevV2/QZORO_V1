import { PROVIDERS, PROVIDER_ENV } from "./constants";
import type { ClientSettings, DeskSettings, KeySource, ProviderId } from "./types";

export function resolveApiKey(
  provider: ProviderId,
  settings: DeskSettings,
): { key: string; source: KeySource } {
  const stored = settings.apiKeys[provider]?.trim();
  if (stored) return { key: stored, source: "stored" };

  for (const name of PROVIDER_ENV[provider]) {
    const value = process.env[name]?.trim();
    if (value) return { key: value, source: "env" };
  }
  return { key: "", source: "none" };
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `••••${key.slice(-4)}`;
}

export function toClientSettings(settings: DeskSettings): ClientSettings {
  const rest: Omit<DeskSettings, "apiKeys"> = {
    provider: settings.provider,
    models: settings.models,
    account: settings.account,
    instrument: settings.instrument,
    updatedAt: settings.updatedAt,
  };
  const keys = Object.fromEntries(
    PROVIDERS.map((provider) => {
      const resolved = resolveApiKey(provider, settings);
      return [
        provider,
        {
          hasKey: Boolean(resolved.key),
          hint: resolved.key ? maskKey(resolved.key) : "",
          source: resolved.source,
        },
      ];
    }),
  ) as ClientSettings["keys"];
  return { ...rest, keys };
}

export function activeKeyStatus(settings: DeskSettings): { ready: boolean; source: KeySource } {
  const resolved = resolveApiKey(settings.provider, settings);
  return { ready: Boolean(resolved.key), source: resolved.source };
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && PROVIDERS.some((provider) => provider === value);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value: unknown, fallback: string, max = 120): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

/**
 * Applies an untrusted patch to the existing settings. Unknown fields are ignored.
 * API keys are only replaced when a non-empty value arrives; an empty string leaves
 * the stored key alone. Use `clearKeys` to remove a key deliberately.
 */
export function applySettingsPatch(existing: DeskSettings, body: unknown): DeskSettings {
  const input = (body ?? {}) as Record<string, unknown>;
  const next: DeskSettings = structuredClone(existing);

  if (isProviderId(input.provider)) {
    next.provider = input.provider;
  }

  if (input.models && typeof input.models === "object") {
    const models = input.models as Record<string, unknown>;
    for (const provider of PROVIDERS) {
      const value = models[provider];
      if (typeof value === "string" && value.trim()) {
        next.models[provider] = value.trim().slice(0, 80);
      }
    }
  }

  if (input.apiKeys && typeof input.apiKeys === "object") {
    const keys = input.apiKeys as Record<string, unknown>;
    for (const provider of PROVIDERS) {
      const value = keys[provider];
      if (typeof value === "string" && value.trim()) {
        next.apiKeys[provider] = value.trim().slice(0, 500);
      }
    }
  }

  if (Array.isArray(input.clearKeys)) {
    for (const value of input.clearKeys as unknown[]) {
      if (isProviderId(value)) {
        next.apiKeys[value] = "";
      }
    }
  }

  if (input.account && typeof input.account === "object") {
    const account = input.account as Record<string, unknown>;
    next.account.balance = finiteNumber(account.balance, next.account.balance, 100, 10_000_000);
    next.account.riskPerTradePct = finiteNumber(account.riskPerTradePct, next.account.riskPerTradePct, 0.1, 10);
    next.account.maxDailyLossPct = finiteNumber(account.maxDailyLossPct, next.account.maxDailyLossPct, 0.5, 20);
    next.account.maxWeeklyLossPct = finiteNumber(account.maxWeeklyLossPct, next.account.maxWeeklyLossPct, 1, 40);
    next.account.maxTradesPerDay = Math.round(
      finiteNumber(account.maxTradesPerDay, next.account.maxTradesPerDay, 1, 20),
    );
    next.account.maxConsecutiveLosses = Math.round(
      finiteNumber(account.maxConsecutiveLosses, next.account.maxConsecutiveLosses, 1, 10),
    );
    next.account.minRR = finiteNumber(account.minRR, next.account.minRR, 1, 10);
    next.account.minConfidence = Math.round(
      finiteNumber(account.minConfidence, next.account.minConfidence, 0, 95),
    );
    next.account.currency = "USD";
  }

  if (input.instrument && typeof input.instrument === "object") {
    const instrument = input.instrument as Record<string, unknown>;
    next.instrument.symbol = text(instrument.symbol, next.instrument.symbol, 12).toUpperCase();
    next.instrument.contractSize = finiteNumber(instrument.contractSize, next.instrument.contractSize, 1, 1000);
    next.instrument.spread = finiteNumber(instrument.spread, next.instrument.spread, 0, 20);
    next.instrument.commissionPerLot = finiteNumber(
      instrument.commissionPerLot,
      next.instrument.commissionPerLot,
      0,
      500,
    );
  }

  return next;
}
