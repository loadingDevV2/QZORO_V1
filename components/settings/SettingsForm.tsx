"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  ACCOUNT_LIMITS,
  MODEL_OPTIONS,
  PROVIDER_ENV,
  PROVIDER_LABEL,
  PROVIDERS,
} from "@/lib/constants";
import { fmtDateTime, fmtPct, fmtUsd } from "@/lib/format";
import type { AccountRules, ClientSettings, ProviderId } from "@/lib/types";

type AccountNumberKey = keyof Pick<
  AccountRules,
  | "balance"
  | "riskPerTradePct"
  | "maxDailyLossPct"
  | "maxWeeklyLossPct"
  | "maxTradesPerDay"
  | "maxConsecutiveLosses"
  | "minRR"
  | "minConfidence"
>;

interface AccountForm {
  balance: string;
  riskPerTradePct: string;
  maxDailyLossPct: string;
  maxWeeklyLossPct: string;
  maxTradesPerDay: string;
  maxConsecutiveLosses: string;
  minRR: string;
  minConfidence: string;
}

interface FormState {
  provider: ProviderId;
  models: Record<ProviderId, string>;
  account: AccountForm;
  instrument: {
    symbol: string;
    contractSize: string;
    spread: string;
    commissionPerLot: string;
  };
  keyInputs: Record<ProviderId, string>;
}

const ACCOUNT_FIELDS: {
  key: AccountNumberKey;
  label: string;
  unit: string;
  hint: string;
  step: string;
}[] = [
  {
    key: "balance",
    label: "Account balance",
    unit: "USD",
    hint: "The capital every size and limit is computed against.",
    step: "100",
  },
  {
    key: "riskPerTradePct",
    label: "Risk per trade",
    unit: "%",
    hint: "The desk sizes every ticket to this loss at the stop.",
    step: "0.1",
  },
  {
    key: "maxDailyLossPct",
    label: "Daily loss cap",
    unit: "%",
    hint: "Reaching this closes the desk for the day.",
    step: "0.1",
  },
  {
    key: "maxWeeklyLossPct",
    label: "Weekly loss cap",
    unit: "%",
    hint: "A second backstop when the week goes wrong.",
    step: "0.1",
  },
  {
    key: "maxTradesPerDay",
    label: "Max trades / day",
    unit: "trades",
    hint: "Counts every entry, including open positions.",
    step: "1",
  },
  {
    key: "maxConsecutiveLosses",
    label: "Loss-streak stop",
    unit: "losses",
    hint: "The desk locks after this many losses in a row.",
    step: "1",
  },
  {
    key: "minRR",
    label: "Minimum R:R",
    unit: "R",
    hint: "TP1 must pay at least this much after costs.",
    step: "0.1",
  },
  {
    key: "minConfidence",
    label: "Minimum confidence",
    unit: "/100",
    hint: "Below this read, the desk stands down.",
    step: "1",
  },
];

const INSTRUMENT_FIELDS = [
  {
    key: "contractSize",
    label: "Contract size",
    unit: "oz / lot",
    hint: "XAUUSD is normally 100 oz per standard lot.",
    step: "1",
    min: ACCOUNT_LIMITS.contractSize.min,
    max: ACCOUNT_LIMITS.contractSize.max,
  },
  {
    key: "spread",
    label: "Spread",
    unit: "USD / oz",
    hint: "Charged on both sides in every size calculation.",
    step: "0.01",
    min: ACCOUNT_LIMITS.spread.min,
    max: ACCOUNT_LIMITS.spread.max,
  },
  {
    key: "commissionPerLot",
    label: "Commission",
    unit: "USD / lot",
    hint: "Round-trip commission. Use 0 if your spread covers it.",
    step: "0.01",
    min: ACCOUNT_LIMITS.commissionPerLot.min,
    max: ACCOUNT_LIMITS.commissionPerLot.max,
  },
] as const;

function toForm(settings: ClientSettings): FormState {
  return {
    provider: settings.provider,
    models: { ...settings.models },
    account: {
      balance: String(settings.account.balance),
      riskPerTradePct: String(settings.account.riskPerTradePct),
      maxDailyLossPct: String(settings.account.maxDailyLossPct),
      maxWeeklyLossPct: String(settings.account.maxWeeklyLossPct),
      maxTradesPerDay: String(settings.account.maxTradesPerDay),
      maxConsecutiveLosses: String(settings.account.maxConsecutiveLosses),
      minRR: String(settings.account.minRR),
      minConfidence: String(settings.account.minConfidence),
    },
    instrument: {
      symbol: settings.instrument.symbol,
      contractSize: String(settings.instrument.contractSize),
      spread: String(settings.instrument.spread),
      commissionPerLot: String(settings.instrument.commissionPerLot),
    },
    keyInputs: { gemini: "", openai: "", anthropic: "", opencode: "" },
  };
}

function numericPatch(source: Record<string, string>, keys: readonly string[]): Record<string, number> {
  const patch: Record<string, number> = {};
  for (const key of keys) {
    const raw = source[key]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) patch[key] = value;
  }
  return patch;
}

function Section({
  index,
  title,
  description,
  aside,
  children,
}: {
  index: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex gap-3">
          <span className="mt-0.5 font-mono text-[9px] tracking-[0.16em] text-accent">{index}</span>
          <div>
            <h2 className="text-[17px] tracking-[-0.02em] text-bone">{title}</h2>
            <p className="mt-1 max-w-[64ch] text-[11.5px] leading-relaxed text-faint">{description}</p>
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsForm({
  settings,
  counts,
}: {
  settings: ClientSettings;
  counts: { trades: number; analyses: number };
}) {
  const router = useRouter();
  const [base, setBase] = useState(settings);
  const [form, setForm] = useState<FormState>(() => toForm(settings));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [clearKeys, setClearKeys] = useState<ProviderId[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Record<ProviderId, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    opencode: false,
  });
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [testResults, setTestResults] = useState<
    Partial<Record<ProviderId, { tone: "long" | "short"; message: string }>>
  >({});
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const balance = Number(form.account.balance);
  const riskPct = Number(form.account.riskPerTradePct);
  const dailyPct = Number(form.account.maxDailyLossPct);
  const weeklyPct = Number(form.account.maxWeeklyLossPct);
  const maxTrades = Number(form.account.maxTradesPerDay);
  const minRR = Number(form.account.minRR);
  const minConfidence = Number(form.account.minConfidence);
  const riskUsd = Number.isFinite(balance * riskPct) ? (balance * riskPct) / 100 : null;
  const dailyUsd = Number.isFinite(balance * dailyPct) ? (balance * dailyPct) / 100 : null;
  const weeklyUsd = Number.isFinite(balance * weeklyPct) ? (balance * weeklyPct) / 100 : null;

  const contract = Number(form.instrument.contractSize);
  const spread = Number(form.instrument.spread);
  const commission = Number(form.instrument.commissionPerLot);
  const costPerLot =
    Number.isFinite(contract * spread + commission) ? contract * spread + commission : null;

  const advisories: string[] = [];
  if (Number.isFinite(dailyPct) && Number.isFinite(weeklyPct) && dailyPct > weeklyPct) {
    advisories.push("The daily cap is larger than the weekly cap. One session could exhaust the week.");
  }
  if (Number.isFinite(riskPct) && Number.isFinite(dailyPct) && riskPct > dailyPct) {
    advisories.push("One full-size loss exceeds the daily cap. The desk would lock after the first stop.");
  }
  if (
    Number.isFinite(riskPct) &&
    Number.isFinite(dailyPct) &&
    Number.isFinite(maxTrades) &&
    riskPct * maxTrades > dailyPct
  ) {
    advisories.push(
      `${maxTrades} full-size losses (${riskPct * maxTrades}%) can exceed the ${dailyPct}% daily cap.`,
    );
  }
  if (Number.isFinite(minRR) && minRR < 1.5) {
    advisories.push("A minimum under 1.5R leaves little room for costs and slippage.");
  }
  if (Number.isFinite(minConfidence) && minConfidence < 50) {
    advisories.push("A confidence floor under 50 lets weak reads through the gate.");
  }

  function updateAccount(key: AccountNumberKey, value: string) {
    setForm((prev) => ({ ...prev, account: { ...prev.account, [key]: value } }));
    setDirty(true);
    setSavedMessage(null);
  }

  function updateInstrument(key: keyof FormState["instrument"], value: string) {
    setForm((prev) => ({ ...prev, instrument: { ...prev.instrument, [key]: value } }));
    setDirty(true);
    setSavedMessage(null);
  }

  function updateKey(provider: ProviderId, value: string) {
    setForm((prev) => ({ ...prev, keyInputs: { ...prev.keyInputs, [provider]: value } }));
    setClearKeys((prev) => prev.filter((item) => item !== provider));
    setTestResults((prev) => ({ ...prev, [provider]: undefined }));
    setDirty(true);
    setSavedMessage(null);
  }

  function toggleClear(provider: ProviderId) {
    setClearKeys((prev) =>
      prev.includes(provider) ? prev.filter((item) => item !== provider) : [...prev, provider],
    );
    setForm((prev) => ({ ...prev, keyInputs: { ...prev.keyInputs, [provider]: "" } }));
    setTestResults((prev) => ({ ...prev, [provider]: undefined }));
    setDirty(true);
    setSavedMessage(null);
  }

  async function testProvider(provider: ProviderId) {
    setTesting(provider);
    setTestResults((prev) => ({ ...prev, [provider]: undefined }));
    try {
      const response = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          model: form.models[provider],
          apiKey: form.keyInputs[provider].trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        latencyMs?: number;
        sample?: string;
      };
      if (!response.ok) {
        setTestResults((prev) => ({
          ...prev,
          [provider]: { tone: "short", message: payload.error ?? "The test call failed." },
        }));
        return;
      }
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          tone: "long",
          message: `Answered in ${((payload.latencyMs ?? 0) / 1000).toFixed(1)}s${
            payload.sample ? ` · “${payload.sample}”` : ""
          }`,
        },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { tone: "short", message: "Could not reach the desk. Check the connection." },
      }));
    } finally {
      setTesting(null);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);

    const accountPatch = numericPatch(form.account as unknown as Record<string, string>, [
      "balance",
      "riskPerTradePct",
      "maxDailyLossPct",
      "maxWeeklyLossPct",
      "maxTradesPerDay",
      "maxConsecutiveLosses",
      "minRR",
      "minConfidence",
    ]);
    const instrumentPatch = {
      symbol: form.instrument.symbol,
      ...numericPatch(form.instrument as unknown as Record<string, string>, [
        "contractSize",
        "spread",
        "commissionPerLot",
      ]),
    };
    const apiKeys: Partial<Record<ProviderId, string>> = {};
    for (const provider of PROVIDERS) {
      const value = form.keyInputs[provider].trim();
      if (value) apiKeys[provider] = value;
    }

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          models: form.models,
          apiKeys,
          clearKeys: clearKeys.filter((provider) => !form.keyInputs[provider].trim()),
          account: accountPatch,
          instrument: instrumentPatch,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        settings?: ClientSettings;
        error?: string;
      };
      if (!response.ok || !payload.settings) {
        setSaveError(payload.error ?? "The settings could not be saved.");
        return;
      }
      setBase(payload.settings);
      setForm(toForm(payload.settings));
      setClearKeys([]);
      setDirty(false);
      setSavedMessage("Settings saved. New reviews and entries will use these rules.");
      setTestResults({});
      router.refresh();
    } catch {
      setSaveError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function revert() {
    setForm(toForm(base));
    setClearKeys([]);
    setDirty(false);
    setSaveError(null);
    setSavedMessage(null);
    setTestResults({});
  }

  async function resetJournal() {
    if (resetConfirm !== "RESET" || resetting) return;
    setResetting(true);
    setResetError(null);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: resetConfirm }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setResetError(payload.error ?? "The journal could not be cleared.");
        return;
      }
      setResetConfirm("");
      setResetDone(true);
      router.refresh();
    } catch {
      setResetError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setResetting(false);
    }
  }

  const displayTrades = resetDone ? 0 : counts.trades;
  const displayAnalyses = resetDone ? 0 : counts.analyses;
  const lastSaved =
    base.updatedAt && new Date(base.updatedAt).getTime() > 0 ? fmtDateTime(base.updatedAt) : "Defaults in use";
  const activeKey = base.keys[form.provider];

  return (
    <div className="space-y-5">
      <div className="panel sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-line-strong px-4 py-3 shadow-[0_14px_44px_rgba(0,0,0,0.42)] lg:top-0">
        <div className="flex items-center gap-2.5">
          <span className={`h-1.5 w-1.5 ${dirty ? "bg-warn" : "bg-long"}`} aria-hidden="true" />
          <span className="font-mono text-[9px] tracking-[0.14em] text-faint">
            {saving ? "SAVING" : dirty ? "UNSAVED CHANGES" : "ALL CHANGES SAVED"}
          </span>
          <span className="hidden text-[10px] text-faint sm:inline">
            Last save: {lastSaved}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-quiet btn-sm" disabled={!dirty || saving} onClick={revert}>
            <RotateCcw size={12} />
            Revert
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="flex items-start gap-2.5 border border-[rgba(255,116,104,0.36)] bg-[rgba(255,116,104,0.055)] px-4 py-3 text-[11.5px] leading-relaxed text-short">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {saveError}
        </div>
      ) : null}
      {savedMessage ? (
        <div className="flex items-start gap-2.5 border border-[rgba(95,211,155,0.3)] bg-[rgba(95,211,155,0.05)] px-4 py-3 text-[11.5px] leading-relaxed text-long" aria-live="polite">
          <Check size={14} className="mt-0.5 shrink-0" />
          {savedMessage}
        </div>
      ) : null}

      <Section
        index="01"
        title="Provider & keys"
        description="The model reads the chart. All sizing and validation happen on this desk, not in the model. Keys are encrypted on the server."
        aside={
          <span className="inline-flex items-center gap-2 border border-line px-2.5 py-1.5">
            <span className={`h-1.5 w-1.5 ${activeKey.hasKey ? "bg-long" : "bg-short"}`} aria-hidden="true" />
            <span className="font-mono text-[8.5px] tracking-[0.12em] text-muted">
              {PROVIDER_LABEL[form.provider].toUpperCase()}
            </span>
          </span>
        }
      >
        <div className="divide-y divide-line">
          {PROVIDERS.map((provider) => {
            const active = form.provider === provider;
            const keyStatus = base.keys[provider];
            const pendingKey = form.keyInputs[provider].trim().length > 0;
            const pendingClear = clearKeys.includes(provider);
            const canTest = pendingKey || (keyStatus.hasKey && !pendingClear);
            const result = testResults[provider];

            return (
              <div
                key={provider}
                className={`grid gap-4 px-5 py-5 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.2fr)] ${
                  active ? "bg-[rgba(185,243,109,0.035)]" : ""
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="provider"
                    className="sr-only"
                    checked={active}
                    onChange={() => {
                      setForm((prev) => ({ ...prev, provider }));
                      setDirty(true);
                      setSavedMessage(null);
                    }}
                  />
                  <span
                    className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-accent" : "border-line-strong"
                    }`}
                    aria-hidden="true"
                  >
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  </span>
                  <span>
                    <span className="block text-[12.5px] text-bone">{PROVIDER_LABEL[provider]}</span>
                    <span className="mt-1 block font-mono text-[8.5px] tracking-[0.1em] text-faint">
                      {active ? "ACTIVE DESK" : "STANDBY"}
                    </span>
                    <span className="mt-1.5 block text-[9.5px] leading-relaxed text-faint">
                      {PROVIDER_ENV[provider][0]}
                    </span>
                  </span>
                </label>

                <label className="block">
                  <span className="field-label">Model ID</span>
                  <input
                    type="text"
                    className="field !text-[12px]"
                    list={`models-${provider}`}
                    value={form.models[provider]}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        models: { ...prev.models, [provider]: value },
                      }));
                      setTestResults((prev) => ({ ...prev, [provider]: undefined }));
                      setDirty(true);
                      setSavedMessage(null);
                    }}
                  />
                  <datalist id={`models-${provider}`}>
                    {MODEL_OPTIONS[provider].map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </datalist>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-faint">
                    {provider === "opencode"
                      ? "Use deepseek-v4.1-flash with a Go plan key. The in-app Free variant is not callable here."
                      : "Pick a known ID or type the exact model your key can access."}
                  </p>
                </label>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="field-label">API key</span>
                    <span
                      className={`font-mono text-[8.5px] tracking-[0.1em] ${
                        pendingClear
                          ? "text-short"
                          : pendingKey
                            ? "text-accent-bright"
                            : keyStatus.hasKey
                              ? "text-long"
                              : "text-faint"
                      }`}
                    >
                      {pendingClear
                        ? "WILL REMOVE ON SAVE"
                        : pendingKey
                          ? "NEW KEY PENDING"
                          : keyStatus.hasKey
                            ? keyStatus.source === "env"
                              ? "FROM ENVIRONMENT"
                              : `ON FILE ${keyStatus.hint}`
                            : "NO KEY"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <KeyRound size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                      <input
                        type={visibleKeys[provider] ? "text" : "password"}
                        className="field !pl-8 !pr-9 !text-[12px]"
                        aria-label={`${PROVIDER_LABEL[provider]} API key`}
                        placeholder={
                          keyStatus.hasKey
                            ? "Paste to replace the key"
                            : "Paste the API key"
                        }
                        value={form.keyInputs[provider]}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => updateKey(provider, event.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={visibleKeys[provider] ? "Hide key" : "Show key"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-faint transition-colors hover:text-bone"
                        onClick={() =>
                          setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))
                        }
                      >
                        {visibleKeys[provider] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm shrink-0"
                      disabled={!canTest || testing === provider}
                      onClick={() => testProvider(provider)}
                    >
                      {testing === provider ? <Loader2 size={12} className="animate-spin" /> : null}
                      {testing === provider ? "Testing…" : "Test"}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[9.5px] leading-relaxed text-faint">
                      {keyStatus.hasKey
                        ? keyStatus.source === "env"
                          ? "Loaded from the environment. A stored key overrides it."
                          : "Encrypted on the server. The browser only sees the mask."
                        : "No key on file. The sample review still works."}
                    </p>
                    {keyStatus.source === "stored" ? (
                      <button
                        type="button"
                        className={`font-mono text-[8.5px] tracking-[0.1em] transition-colors ${
                          pendingClear ? "text-accent hover:text-accent-bright" : "text-faint hover:text-short"
                        }`}
                        onClick={() => toggleClear(provider)}
                      >
                        {pendingClear ? "KEEP KEY" : "REMOVE KEY"}
                      </button>
                    ) : null}
                  </div>

                  {result ? (
                    <p
                      className={`mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed ${
                        result.tone === "long" ? "text-long" : "text-short"
                      }`}
                    >
                      {result.tone === "long" ? (
                        <Check size={11} className="mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                      )}
                      {result.message}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section
          index="02"
          title="Account mandate"
          description="These limits decide whether a ticket clears and when the desk locks. Change them deliberately."
          aside={
            <span className="font-mono text-[8.5px] tracking-[0.12em] text-faint">
              RISK {fmtPct(Number.isFinite(riskPct) ? riskPct : null, 2)}
            </span>
          }
        >
          <div className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {ACCOUNT_FIELDS.map((field) => {
                const limits = ACCOUNT_LIMITS[field.key];
                return (
                  <label key={field.key} className="block">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="field-label">{field.label}</span>
                      <span className="font-mono text-[8.5px] tracking-[0.08em] text-faint">
                        {field.unit}
                      </span>
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="field !text-[12px]"
                      min={limits.min}
                      max={limits.max}
                      step={field.step}
                      value={form.account[field.key]}
                      onChange={(event) => updateAccount(field.key, event.target.value)}
                    />
                    <span className="mt-1.5 block text-[9.5px] leading-relaxed text-faint">
                      {field.hint}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-px border border-line bg-line">
              <div className="bg-panel-2 px-3.5 py-3">
                <div className="label">Risk / trade</div>
                <div className="num mt-1.5 text-[13px] text-bone">{riskUsd == null ? "—" : fmtUsd(riskUsd)}</div>
              </div>
              <div className="bg-panel-2 px-3.5 py-3">
                <div className="label">Daily stop</div>
                <div className="num mt-1.5 text-[13px] text-bone">{dailyUsd == null ? "—" : fmtUsd(dailyUsd)}</div>
              </div>
              <div className="bg-panel-2 px-3.5 py-3">
                <div className="label">Weekly stop</div>
                <div className="num mt-1.5 text-[13px] text-bone">{weeklyUsd == null ? "—" : fmtUsd(weeklyUsd)}</div>
              </div>
            </div>

            {advisories.length > 0 ? (
              <div className="mt-4 border border-[rgba(230,180,90,0.3)] bg-[rgba(230,180,90,0.045)] px-3.5 py-3">
                <div className="flex items-center gap-2 text-warn">
                  <AlertTriangle size={12} />
                  <span className="font-mono text-[8.5px] tracking-[0.12em]">CHECK THE MANDATE</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {advisories.map((advisory) => (
                    <li key={advisory} className="text-[10.5px] leading-relaxed text-warn/90">
                      {advisory}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Section>

        <Section
          index="03"
          title="Instrument & costs"
          description="XAUUSD is quoted per troy ounce. Costs are charged on both sides so the plan is never flattered."
        >
          <div className="p-5">
            <label className="mb-4 block">
              <span className="field-label">Symbol</span>
              <input
                type="text"
                className="field field-text"
                maxLength={12}
                value={form.instrument.symbol}
                onChange={(event) => updateInstrument("symbol", event.target.value.toUpperCase())}
              />
              <span className="mt-1.5 block text-[9.5px] leading-relaxed text-faint">
                QZORO only clears reviews labelled XAUUSD or GOLD. Use the symbol your broker shows.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              {INSTRUMENT_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="field-label">{field.label}</span>
                    <span className="font-mono text-[8.5px] tracking-[0.08em] text-faint">
                      {field.unit}
                    </span>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="field !text-[12px]"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={form.instrument[field.key]}
                    onChange={(event) => updateInstrument(field.key, event.target.value)}
                  />
                  <span className="mt-1.5 block text-[9.5px] leading-relaxed text-faint">
                    {field.hint}
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-px border border-line bg-line">
              <div className="bg-panel-2 px-3.5 py-3">
                <div className="label">A $1.00 move</div>
                <div className="num mt-1.5 text-[13px] text-bone">
                  {Number.isFinite(contract) ? fmtUsd(contract) : "—"} <span className="text-faint">/ lot</span>
                </div>
              </div>
              <div className="bg-panel-2 px-3.5 py-3">
                <div className="label">Round-trip cost</div>
                <div className="num mt-1.5 text-[13px] text-bone">
                  {costPerLot == null ? "—" : fmtUsd(costPerLot)} <span className="text-faint">/ lot</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-faint">
              Changing these values re-prices new tickets and new entries. Existing ledger rows keep
              the risk they were logged with.
            </p>
          </div>
        </Section>
      </div>

      <Section
        index="04"
        title="Data & reset"
        description="The journal lives in Supabase. Export it before you wipe it; cleared rows and chart objects cannot be restored."
        aside={
          <span className="font-mono text-[8.5px] tracking-[0.12em] text-faint">
            {displayTrades} TRADES · {displayAnalyses} REVIEWS
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-[1.25fr_1fr]">
          <div className="bg-panel p-5">
            <div className="label">Export</div>
            <p className="mt-2 max-w-[52ch] text-[11.5px] leading-relaxed text-faint">
              Download every ledger entry as a CSV: dates, levels, size, risk, R, P&amp;L, and the
              plan-adherence flag.
            </p>
            <a href="/api/export" download className="btn btn-ghost btn-sm mt-4">
              <Download size={13} />
              Download the journal
            </a>
            <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
              <Link href="/journal" className="link-underline font-mono text-[9px] tracking-[0.1em] text-muted">
                OPEN THE LEDGER →
              </Link>
            </div>
          </div>

          <div className="bg-[rgba(255,116,104,0.025)] p-5">
            <div className="label text-short">Clear journal</div>
            <p className="mt-2 max-w-[52ch] text-[11.5px] leading-relaxed text-faint">
              Removes every trade, every filed review, and every uploaded chart. Settings and API
              keys stay. This cannot be undone.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                className="field field-text !w-[150px]"
                placeholder="Type RESET"
                value={resetConfirm}
                onChange={(event) => {
                  setResetConfirm(event.target.value);
                  setResetDone(false);
                }}
                aria-label="Type RESET to confirm clearing the journal"
              />
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={resetConfirm !== "RESET" || resetting}
                onClick={resetJournal}
              >
                {resetting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {resetting ? "Clearing…" : "Clear everything"}
              </button>
            </div>
            {resetError ? <p className="mt-2 text-[10.5px] text-short">{resetError}</p> : null}
            {resetDone ? (
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-long" aria-live="polite">
                <Check size={11} />
                Journal cleared. The desk is blank.
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      <p className="px-1 text-[10px] leading-relaxed text-faint">
        Settings are scoped to your account. The model provider receives chart screenshots but never
        your account balance, journal, or API keys beyond the key used to call it.
      </p>
    </div>
  );
}
