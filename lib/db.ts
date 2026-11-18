import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CHART_BUCKET, PROVIDERS, DEFAULT_SETTINGS } from "./constants";
import { decryptSecret, encryptSecret } from "./crypto";
import { applySettingsPatch } from "./settings-service";
import { createSupabaseServerClient } from "./supabase/server";
import type {
  AnalysisRecord,
  AnalysisSummary,
  DeskSettings,
  Direction,
  ProviderId,
  Trade,
  TradeResult,
  TradeSource,
  Verdict,
} from "./types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const PAGE_SIZE = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

interface SettingsRow {
  provider: string;
  models: unknown;
  account: unknown;
  instrument: unknown;
  updated_at: string;
}

interface ProviderKeyRow {
  provider: string;
  ciphertext: string;
}

interface TradeRow {
  id: string;
  created_at: string;
  trade_date: string;
  symbol: string;
  direction: string;
  setup: string | null;
  entry: number | string;
  stop_loss: number | string;
  take_profit: number | string;
  exit_price: number | string | null;
  lots: number | string;
  risk_usd: number | string;
  risk_pct: number | string;
  planned_rr: number | string;
  result: string;
  r_multiple: number | string | null;
  pnl_usd: number | string | null;
  notes: string | null;
  analysis_id: string | null;
  followed_plan: boolean;
  source: string;
}

interface AnalysisRow {
  id: string;
  created_at: string;
  provider: string;
  model: string;
  demo: boolean;
  timeframe: string | null;
  verdict: string;
  direction: string;
  setup_name: string | null;
  confidence: number | null;
  payload_json: unknown;
  image_path: string | null;
}

interface AnalysisInput {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  demo: boolean;
  timeframe: string;
  record: AnalysisRecord;
  imagePath: string | null;
  imageMime: string | null;
}

export type TradeInput = Omit<Trade, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.includes(value as ProviderId);
}

function mapTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    createdAt: row.created_at,
    tradeDate: row.trade_date,
    symbol: row.symbol,
    direction: row.direction === "short" ? "short" : "long",
    setup: row.setup ?? "",
    entry: Number(row.entry),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    exitPrice: numberOrNull(row.exit_price),
    lots: Number(row.lots),
    riskUsd: Number(row.risk_usd),
    riskPct: Number(row.risk_pct),
    plannedRr: Number(row.planned_rr),
    result: row.result as TradeResult,
    rMultiple: numberOrNull(row.r_multiple),
    pnlUsd: numberOrNull(row.pnl_usd),
    notes: row.notes ?? "",
    analysisId: row.analysis_id,
    followedPlan: row.followed_plan,
    source: row.source as TradeSource,
  };
}

function tradeRow(input: Omit<Trade, "id" | "createdAt">) {
  return {
    trade_date: input.tradeDate,
    symbol: input.symbol,
    direction: input.direction,
    setup: input.setup,
    entry: input.entry,
    stop_loss: input.stopLoss,
    take_profit: input.takeProfit,
    exit_price: input.exitPrice,
    lots: input.lots,
    risk_usd: input.riskUsd,
    risk_pct: input.riskPct,
    planned_rr: input.plannedRr,
    result: input.result,
    r_multiple: input.rMultiple,
    pnl_usd: input.pnlUsd,
    notes: input.notes,
    analysis_id: input.analysisId,
    followed_plan: input.followedPlan,
    source: input.source,
  };
}

async function getClient(): Promise<SupabaseClient> {
  return createSupabaseServerClient();
}

function loadError(scope: string, error: { message: string } | null): Error {
  return new Error(`${scope}: ${error?.message ?? "unknown database error"}`);
}

export async function readSettings(userId: string): Promise<DeskSettings> {
  const supabase = await getClient();
  const [settingsResult, keysResult] = await Promise.all([
    supabase
      .from("desk_settings")
      .select("provider, models, account, instrument, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("provider_keys").select("provider, ciphertext").eq("user_id", userId),
  ]);

  if (settingsResult.error) throw loadError("Could not read desk settings", settingsResult.error);
  if (keysResult.error) throw loadError("Could not read provider keys", keysResult.error);

  const row = settingsResult.data as SettingsRow | null;
  const base = row
    ? applySettingsPatch(DEFAULT_SETTINGS, {
        provider: row.provider,
        models: row.models,
        account: row.account,
        instrument: row.instrument,
      })
    : structuredClone(DEFAULT_SETTINGS);

  if (row?.updated_at) base.updatedAt = row.updated_at;

  for (const keyRow of (keysResult.data ?? []) as ProviderKeyRow[]) {
    if (!isProviderId(keyRow.provider)) continue;
    const value = decryptSecret(keyRow.ciphertext);
    if (!value) {
      // Never treat an undecryptable key as "no key" and then clear it on the
      // next settings save. A missing/rotated APP_ENCRYPTION_KEY must fail loud.
      throw new Error(
        "A stored provider key could not be decrypted. Check that APP_ENCRYPTION_KEY matches the key used to save it.",
      );
    }
    base.apiKeys[keyRow.provider] = value;
  }

  return base;
}

export async function writeSettings(userId: string, settings: DeskSettings): Promise<DeskSettings> {
  const supabase = await getClient();
  const next: DeskSettings = { ...settings, updatedAt: new Date().toISOString() };

  // Encrypt every new key before the first write so a missing or invalid
  // APP_ENCRYPTION_KEY fails before any settings or ciphertext is changed.
  const encryptedKeys = PROVIDERS.flatMap((provider) => {
    const key = next.apiKeys[provider]?.trim();
    return key ? [{ user_id: userId, provider, ciphertext: encryptSecret(key) }] : [];
  });
  const clearedProviders = PROVIDERS.filter((provider) => !next.apiKeys[provider]?.trim());

  const { error: settingsError } = await supabase.from("desk_settings").upsert(
    {
      user_id: userId,
      provider: next.provider,
      models: next.models,
      account: next.account,
      instrument: next.instrument,
      updated_at: next.updatedAt,
    },
    { onConflict: "user_id" },
  );
  if (settingsError) throw loadError("Could not save desk settings", settingsError);

  if (clearedProviders.length > 0) {
    const { error } = await supabase
      .from("provider_keys")
      .delete()
      .eq("user_id", userId)
      .in("provider", clearedProviders);
    if (error) throw loadError("Could not clear provider keys", error);
  }

  if (encryptedKeys.length > 0) {
    const { error } = await supabase
      .from("provider_keys")
      .upsert(encryptedKeys, { onConflict: "user_id,provider" });
    if (error) throw loadError("Could not save provider keys", error);
  }

  return next;
}

export async function listTrades(userId: string): Promise<Trade[]> {
  const supabase = await getClient();
  const { count, error: countError } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw loadError("Could not count the ledger", countError);

  const total = count ?? 0;
  if (total === 0) return [];

  const rows: TradeRow[] = [];
  while (rows.length < total) {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw loadError("Could not read the ledger", error);

    const page = (data ?? []) as TradeRow[];
    if (page.length === 0) break;
    rows.push(...page);
  }

  return rows.map(mapTrade);
}

export async function hasTradeForAnalysis(userId: string, analysisId: string): Promise<boolean> {
  if (!isUuid(analysisId)) return false;
  const supabase = await getClient();
  const { count, error } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("analysis_id", analysisId);
  if (error) throw loadError("Could not check the ledger", error);
  return (count ?? 0) > 0;
}

export async function getTrade(userId: string, id: string): Promise<Trade | null> {
  if (!isUuid(id)) return null;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw loadError("Could not read the trade", error);
  return data ? mapTrade(data as TradeRow) : null;
}

export async function createTrade(userId: string, input: TradeInput): Promise<Trade> {
  const supabase = await getClient();
  const payload: Record<string, unknown> = { user_id: userId, ...tradeRow(input) };
  if (input.id) payload.id = input.id;
  if (input.createdAt) payload.created_at = input.createdAt;

  const { data, error } = await supabase.from("trades").insert(payload).select("*").single();
  if (error) throw loadError("Could not save the trade", error);
  return mapTrade(data as TradeRow);
}

export async function updateTrade(
  userId: string,
  id: string,
  input: Omit<Trade, "id" | "createdAt">,
): Promise<Trade | null> {
  if (!isUuid(id)) return null;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("trades")
    .update(tradeRow(input))
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw loadError("Could not update the trade", error);
  return data ? mapTrade(data as TradeRow) : null;
}

export async function deleteTrade(userId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw loadError("Could not delete the trade", error);
  return (data?.length ?? 0) > 0;
}

export async function insertAnalysis(userId: string, input: AnalysisInput): Promise<void> {
  const supabase = await getClient();
  const { error } = await supabase.from("analyses").insert({
    id: input.id,
    user_id: userId,
    created_at: input.createdAt,
    provider: input.provider,
    model: input.model,
    demo: input.demo,
    timeframe: input.timeframe,
    verdict: input.record.verdict,
    direction: input.record.raw.direction,
    setup_name: input.record.raw.setupName,
    confidence: input.record.raw.confidence,
    payload_json: input.record,
    image_path: input.imagePath,
    image_mime: input.imageMime,
  });
  if (error) throw loadError("Could not file the review", error);
}

async function signedUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  try {
    const { data, error } = await supabase.storage
      .from(CHART_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (error) {
      console.warn("[storage] could not sign chart URLs", error.message);
      return result;
    }

    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        result.set(item.path, item.signedUrl);
      }
    }
  } catch (error) {
    // A storage hiccup should not hide the reviews themselves.
    console.warn("[storage] signed chart URLs failed", error);
  }
  return result;
}

export async function listAnalyses(userId: string, limit = 12): Promise<AnalysisSummary[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("analyses")
    .select(
      "id, created_at, provider, model, demo, timeframe, verdict, direction, setup_name, confidence, image_path",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw loadError("Could not read reviews", error);

  const rows = (data ?? []) as AnalysisRow[];
  const urls = await signedUrls(
    supabase,
    rows.map((row) => row.image_path).filter((path): path is string => Boolean(path)),
  );

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    provider: row.provider,
    model: row.model,
    demo: row.demo,
    timeframe: row.timeframe ?? "",
    verdict: row.verdict as Verdict,
    direction: row.direction as Direction,
    setupName: row.setup_name ?? "Unreadable review",
    confidence: Number(row.confidence ?? 0),
    imageUrl: row.image_path ? urls.get(row.image_path) ?? null : null,
  }));
}

export async function getAnalysis(userId: string, id: string): Promise<AnalysisRecord | null> {
  if (!isUuid(id)) return null;
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, payload_json, image_path")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw loadError("Could not read the review", error);
  if (!data) return null;

  let record: AnalysisRecord;
  try {
    const parsed =
      typeof data.payload_json === "string"
        ? (JSON.parse(data.payload_json) as unknown)
        : data.payload_json;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("raw" in parsed) ||
      !parsed.raw ||
      typeof parsed.raw !== "object" ||
      !("guardrails" in parsed) ||
      !parsed.guardrails ||
      typeof parsed.guardrails !== "object" ||
      !("verdict" in parsed) ||
      typeof parsed.verdict !== "string" ||
      !("verdictReasons" in parsed) ||
      !Array.isArray(parsed.verdictReasons)
    ) {
      return null;
    }
    record = parsed as AnalysisRecord;
  } catch {
    return null;
  }

  record.id = data.id as string;
  if (data.image_path) {
    try {
      const { data: signed } = await supabase.storage
        .from(CHART_BUCKET)
        .createSignedUrl(data.image_path as string, SIGNED_URL_TTL_SECONDS);
      record.imageUrl = signed?.signedUrl ?? null;
    } catch (error) {
      console.warn("[storage] signed chart URL failed", error);
      record.imageUrl = null;
    }
  } else {
    record.imageUrl = null;
  }

  return record;
}

export async function counts(userId: string): Promise<{ trades: number; analyses: number }> {
  const supabase = await getClient();
  const [trades, analyses] = await Promise.all([
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("analyses").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (trades.error) throw loadError("Could not count trades", trades.error);
  if (analyses.error) throw loadError("Could not count reviews", analyses.error);

  return { trades: trades.count ?? 0, analyses: analyses.count ?? 0 };
}

export async function clearJournal(): Promise<void> {
  const supabase = await getClient();

  // The SQL function clears both tables in one transaction and returns every
  // chart path as a single JSON array, so more than 1000 reviews are handled.
  const { data, error } = await supabase.rpc("clear_journal");
  if (error) throw loadError("Could not clear the journal", error);

  let payload: unknown = data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }

  const paths = Array.isArray(payload)
    ? payload.filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];

  for (let index = 0; index < paths.length; index += PAGE_SIZE) {
    try {
      const { error: removeError } = await supabase.storage
        .from(CHART_BUCKET)
        .remove(paths.slice(index, index + PAGE_SIZE));
      if (removeError) console.warn("[storage] could not remove cleared charts", removeError.message);
    } catch (error) {
      // The database was already cleared transactionally. Private leftovers are
      // preferable to reporting a failed reset after the journal is empty.
      console.warn("[storage] could not remove cleared charts", error);
    }
  }
}
