"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { AnalysisTicket } from "@/components/analyze/AnalysisTicket";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB, PROVIDER_LABEL, SESSIONS, TIMEFRAMES } from "@/lib/constants";
import { fmtPct, fmtUsd } from "@/lib/format";
import type {
  AccountRules,
  AnalysisRecord,
  Guardrails,
  InstrumentSpec,
  KeySource,
  ProviderId,
} from "@/lib/types";

interface PreparedImage {
  file: File;
  url: string;
  width: number;
  height: number;
}

interface AnalyzeMeta {
  demo: boolean;
  latencyMs: number;
  repaired: boolean;
}

interface AnalyzeResponse {
  analysis: AnalysisRecord;
  meta: AnalyzeMeta;
}

interface BusyState {
  kind: "review" | "demo";
  startedAt: number;
}

interface Notice {
  message: string;
  code?: string;
}

const STEPS = [
  "Uploading the screenshot",
  "Reading structure and levels",
  "Checking geometry and invalidation",
  "Sizing against the mandate",
  "Printing the ticket",
];

const HARD_UPLOAD_LIMIT = 25 * 1024 * 1024;

function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not decode that image. Try a PNG or JPEG."));
    image.src = url;
  });
}

async function prepareImage(file: File): Promise<PreparedImage> {
  const mime = file.type || "";
  if (!ACCEPTED_IMAGE_TYPES.includes(mime)) {
    throw new Error("Use a PNG, JPEG, or WebP screenshot. Convert HEIC or AVIF first.");
  }

  const tempUrl = URL.createObjectURL(file);
  try {
    const image = await decodeImage(tempUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < 320 || height < 240) {
      throw new Error("That image is too small to read. Use a full chart window, not a thumbnail.");
    }

    const longEdge = Math.max(width, height);
    const needsResize = longEdge > 2000 || file.size > MAX_IMAGE_BYTES - 200_000;
    if (!needsResize) {
      return { file, url: tempUrl, width, height };
    }

    const scale = Math.min(1, 2000 / longEdge);
    const nextWidth = Math.max(1, Math.round(width * scale));
    const nextHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare the screenshot for upload.");

    context.fillStyle = "#070b08";
    context.fillRect(0, 0, nextWidth, nextHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, nextWidth, nextHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });
    if (!blob) throw new Error("The screenshot could not be compressed. Try a JPEG.");
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error(`The screenshot is still over ${MAX_IMAGE_MB} MB after compression. Crop it and try again.`);
    }

    const baseName = (file.name || "chart").replace(/\.[^.]+$/, "") || "chart";
    const prepared = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    URL.revokeObjectURL(tempUrl);
    return { file: prepared, url: URL.createObjectURL(prepared), width: nextWidth, height: nextHeight };
  } catch (error) {
    URL.revokeObjectURL(tempUrl);
    throw error;
  }
}

function MandateMini({ guardrails }: { guardrails: Guardrails }) {
  const dot =
    guardrails.status === "clear" ? "bg-long" : guardrails.status === "caution" ? "bg-warn" : "bg-short";
  const word =
    guardrails.status === "clear" ? "CLEAR" : guardrails.status === "caution" ? "CAUTION" : "LOCKED";
  const tone =
    guardrails.status === "clear" ? "text-long" : guardrails.status === "caution" ? "text-warn" : "text-short";

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="label">Today&apos;s mandate</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 ${dot}`} aria-hidden="true" />
          <span className={`font-mono text-[9px] tracking-[0.14em] ${tone}`}>{word}</span>
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] text-faint">Daily loss remaining</span>
          <span className="num text-[12.5px] text-bone">{fmtUsd(guardrails.dailyRemainingUsd)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] text-faint">Trades left</span>
          <span className="num text-[12.5px] text-bone">
            {guardrails.tradesRemaining} / {guardrails.maxTradesPerDay}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] text-faint">Risk per trade</span>
          <span className="num text-[12.5px] text-bone">{fmtUsd(guardrails.riskPerTradeUsd)}</span>
        </div>
      </div>

      {guardrails.status === "locked" ? (
        <p className="mt-4 border-t border-line pt-3 text-[10.5px] leading-relaxed text-short">
          The desk is locked for today. A review can still read the chart, but the ticket will be
          refused.
        </p>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-[10.5px] leading-relaxed text-faint">
          A chart can be reviewed at any time. The mandate decides whether a ticket is cleared.
        </p>
      )}
    </section>
  );
}

export function AnalyzeWorkbench({
  provider,
  model,
  keyReady,
  keySource,
  account,
  instrument,
  guardrails,
  today,
}: {
  provider: ProviderId;
  model: string;
  keyReady: boolean;
  keySource: KeySource;
  account: AccountRules;
  instrument: InstrumentSpec;
  guardrails: Guardrails;
  today: string;
}) {
  const router = useRouter();
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [notes, setNotes] = useState("");
  const [timeframe, setTimeframe] = useState("M15");
  const [session, setSession] = useState("");
  const [highImpactNews, setHighImpactNews] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<BusyState | null>(null);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [showResult, setShowResult] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const showResultRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    showResultRef.current = showResult;
  }, [showResult]);

  useEffect(() => {
    busyRef.current = Boolean(busy || preparing);
  }, [busy, preparing]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  function clearImage() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImage(null);
    setResult(null);
    setShowResult(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForNewReview() {
    clearImage();
    setNotes("");
    setNotice(null);
    setBusy(null);
    window.setTimeout(() => {
      workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  async function acceptFile(file: File) {
    if (busyRef.current) return;
    setNotice(null);
    if (file.size > HARD_UPLOAD_LIMIT) {
      setNotice({ message: "That file is over 25 MB. Crop the chart window and try again." });
      return;
    }

    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = prepared.url;
      setImage(prepared);
      setResult(null);
      setShowResult(false);
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "The screenshot could not be prepared.",
      });
    } finally {
      setPreparing(false);
    }
  }

  const acceptFileRef = useRef(acceptFile);

  useEffect(() => {
    acceptFileRef.current = acceptFile;
  });

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (showResultRef.current || busyRef.current) return;
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      void acceptFileRef.current(file);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (busyRef.current) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void acceptFile(file);
  }

  async function run(kind: "review" | "demo") {
    if (busyRef.current) return;
    if (kind === "review" && (!image || !keyReady)) return;

    setNotice(null);
    setResult(null);
    setShowResult(false);
    const startedAt = Date.now();
    setNow(startedAt);
    setBusy({ kind, startedAt });

    const form = new FormData();
    form.set("demo", kind === "demo" ? "true" : "false");
    form.set("timeframe", timeframe);
    form.set("session", session);
    form.set("highImpactNews", highImpactNews ? "true" : "false");
    form.set("notes", notes.trim());
    if (kind === "review" && image) form.set("image", image.file);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 240_000);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<AnalyzeResponse> & {
        error?: string;
        code?: string;
      };

      if (!response.ok || !payload.analysis) {
        setNotice({
          message: payload.error ?? "The desk could not finish that review. Try again.",
          code: payload.code,
        });
        return;
      }

      const meta = payload.meta ?? { demo: false, latencyMs: 0, repaired: false };
      setResult({ analysis: payload.analysis, meta });
      setShowResult(true);
      setBusy(null);
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      setNotice({
        message: aborted
          ? "The review took longer than four minutes and was cancelled. Try a smaller screenshot or another provider."
          : "Could not reach the desk. Check your connection and try again.",
        code: aborted ? "timeout" : "network",
      });
    } finally {
      window.clearTimeout(timer);
      setBusy(null);
    }
  }

  const elapsed = busy ? Math.max(0, Math.floor((now - busy.startedAt) / 1000)) : 0;
  const activeStep = busy ? Math.min(STEPS.length - 1, Math.floor(elapsed / 6)) : -1;
  const progress = busy ? Math.min(94, 8 + elapsed * 2.4) : 0;
  const canReview = Boolean(image && keyReady && !busy && !preparing);
  const keyLabel = keyReady
    ? keySource === "env"
      ? "Loaded from the environment"
      : "Encrypted on the server"
    : "No key on file";

  return (
    <div ref={workbenchRef}>
      {showResult && result ? (
        <div ref={resultRef} className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="label">{result.meta.demo ? "Sample printed" : "Review filed"}</span>
                {result.meta.demo ? (
                  <span className="border border-accent/40 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.14em] text-accent-bright">
                    SAMPLE
                  </span>
                ) : null}
                {result.meta.repaired ? (
                  <span className="font-mono text-[8.5px] tracking-[0.1em] text-faint">REPAIRED JSON</span>
                ) : null}
              </div>
              <h2 className="mt-2 text-[24px] tracking-[-0.03em] text-bone">The ticket</h2>
              <p className="mt-1 text-[12px] text-faint">
                {result.meta.demo
                  ? "A worked example. The levels are illustrative and cannot be logged."
                  : `${PROVIDER_LABEL[provider]} took ${(result.meta.latencyMs / 1000).toFixed(1)}s to file this read.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {result.analysis.id ? (
                <Link href={`/review/${result.analysis.id}`} className="btn btn-ghost btn-sm">
                  Open filed review
                  <ArrowRight size={13} />
                </Link>
              ) : null}
              <button type="button" className="btn btn-primary btn-sm" onClick={resetForNewReview}>
                <ScanLine size={13} />
                New review
              </button>
            </div>
          </div>

          <AnalysisTicket
            analysis={result.analysis}
            today={today}
            onLogged={() => {
              router.refresh();
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[9px] tracking-[0.16em] text-accent">01</span>
                <span className="label">Intake</span>
              </div>
              <span className="font-mono text-[9px] tracking-[0.13em] text-faint">
                ONE SCREENSHOT + CONTEXT
              </span>
            </div>

            <div className="p-5">
              <input
                ref={fileInputRef}
                id="chart-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={Boolean(busy) || preparing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void acceptFile(file);
                }}
              />

              {image ? (
                <div className="overflow-hidden border border-line bg-ink-2">
                  <div className="relative flex min-h-[280px] items-center justify-center bg-[#050806] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt="Selected XAUUSD chart screenshot"
                      className="max-h-[420px] w-full object-contain"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 inline-flex h-8 items-center gap-1.5 border border-line-strong bg-ink/85 px-2.5 font-mono text-[9px] tracking-[0.1em] text-bone backdrop-blur transition-colors hover:border-accent hover:text-accent-bright"
                      onClick={clearImage}
                      disabled={Boolean(busy)}
                    >
                      <X size={12} />
                      REMOVE
                    </button>
                    {busy ? (
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-[linear-gradient(180deg,rgba(8,9,10,0)_60%,rgba(8,9,10,0.55))]">
                        <span className="mb-4 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-accent-bright">
                          <Loader2 size={12} className="animate-spin" />
                          SCANNING
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] text-muted">{image.file.name}</p>
                      <p className="mt-1 font-mono text-[9.5px] text-faint">
                        {image.width} × {image.height} · {(image.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={Boolean(busy) || preparing}
                    >
                      <ImageIcon size={13} />
                      Replace
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="chart-file"
                  className="dropzone"
                  data-dragging={dragging}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <span className="corner corner-tl" aria-hidden="true" />
                  <span className="corner corner-tr" aria-hidden="true" />
                  <span className="corner corner-bl" aria-hidden="true" />
                  <span className="corner corner-br" aria-hidden="true" />

                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-panel">
                    {preparing ? (
                      <Loader2 size={19} className="animate-spin text-accent" />
                    ) : (
                      <Upload size={19} className="text-accent" strokeWidth={1.6} />
                    )}
                  </span>
                  <h3 className="mt-4 text-[17px] tracking-[-0.02em] text-bone">
                    {preparing ? "Preparing the screenshot…" : "Drop the chart here"}
                  </h3>
                  <p className="mt-2 max-w-[44ch] text-center text-[12px] leading-relaxed text-faint">
                    PNG, JPEG, or WebP. The desk downscales large captures before they leave the
                    browser. A legible price axis matters more than resolution.
                  </p>
                  <span className="btn btn-ghost btn-sm mt-4 pointer-events-none">
                    <ImageIcon size={13} />
                    Choose a screenshot
                  </span>
                  <span className="mt-3 font-mono text-[9px] tracking-[0.14em] text-faint">
                    OR PASTE WITH CTRL / ⌘ + V
                  </span>
                </label>
              )}

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <span className="field-label">Trader&apos;s timeframe</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TIMEFRAMES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="chip"
                        data-active={timeframe === item}
                        aria-pressed={timeframe === item}
                        disabled={Boolean(busy)}
                        onClick={() => setTimeframe(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="field-label">Session</span>
                  <select
                    className="field"
                    value={session}
                    disabled={Boolean(busy)}
                    onChange={(event) => setSession(event.target.value)}
                  >
                    <option value="">Not stated</option>
                    {SESSIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="field-label">What are you seeing?</span>
                <textarea
                  className="field field-text"
                  rows={3}
                  maxLength={800}
                  placeholder="Optional: the level you are watching, the news in play, or why this chart is on your screen."
                  value={notes}
                  disabled={Boolean(busy)}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={highImpactNews}
                  className={`inline-flex items-center gap-2.5 text-[11.5px] transition-colors ${
                    highImpactNews ? "text-warn" : "text-faint hover:text-muted"
                  }`}
                  disabled={Boolean(busy)}
                  onClick={() => setHighImpactNews((value) => !value)}
                >
                  <span
                    className={`relative h-3.5 w-6 rounded-full transition-colors ${
                      highImpactNews ? "bg-warn" : "bg-[rgba(226,242,226,0.18)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-ink transition-transform ${
                        highImpactNews ? "translate-x-[13px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  High-impact news inside 30 minutes
                </button>
                <span className="num text-[9.5px] text-faint">{notes.length} / 800</span>
              </div>

              {notice ? (
                <div
                  className="mt-4 flex items-start gap-3 border border-[rgba(255,116,104,0.36)] bg-[rgba(255,116,104,0.055)] px-3.5 py-3"
                  role="alert"
                >
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-short" strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] leading-relaxed text-bone">{notice.message}</p>
                    {notice.code === "no_key" ? (
                      <Link
                        href="/settings"
                        className="link-underline mt-1.5 inline-flex items-center gap-1 font-mono text-[9.5px] tracking-[0.1em] text-accent"
                      >
                        ADD A KEY <ArrowRight size={11} />
                      </Link>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss error"
                    className="text-faint transition-colors hover:text-bone"
                    onClick={() => setNotice(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              {busy ? (
                <div className="mt-4 border border-line bg-panel-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="label">{busy.kind === "demo" ? "Printing the sample" : "Desk at work"}</span>
                    <span className="num text-[10px] text-faint">{elapsed}s</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {STEPS.map((step, index) => {
                      const done = index < activeStep;
                      const active = index === activeStep;
                      return (
                        <div key={step} className="flex items-center gap-2.5">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 ${
                              done
                                ? "bg-long"
                                : active
                                  ? "animate-[pulse-dot_1.2s_ease-in-out_infinite] bg-accent"
                                  : "bg-[rgba(226,242,226,0.16)]"
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-[11px] ${done ? "text-muted" : active ? "text-bone" : "text-faint"}`}
                          >
                            {step}
                          </span>
                          {done ? <Check size={11} className="text-long" /> : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 bar-track">
                    <div
                      className="bar-fill"
                      style={{ transform: `scaleX(${Math.min(100, Math.max(0, progress)) / 100})` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-faint">
                    A real chart read usually takes 15–45 seconds. Keep this tab open until the
                    ticket prints.
                  </p>
                </div>
              ) : null}

              {!keyReady ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-[rgba(185,243,109,0.32)] bg-[rgba(185,243,109,0.045)] px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <KeyRound size={14} className="shrink-0 text-accent" strokeWidth={1.8} />
                    <p className="text-[11.5px] leading-relaxed text-muted">
                      No {PROVIDER_LABEL[provider]} key on file. The sample works without one; your
                      own chart needs a key.
                    </p>
                  </div>
                  <Link href="/settings" className="btn btn-ghost btn-sm">
                    Add a key
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                disabled={Boolean(busy) || preparing}
                onClick={() => run("demo")}
              >
                <Sparkles size={13} />
                Run sample review
                <span className="ml-1 border border-line px-1 py-0.5 font-mono text-[8px] tracking-[0.1em] text-faint">
                  NO KEY
                </span>
              </button>

              <div className="flex items-center gap-2">
                {image ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={Boolean(busy) || preparing}
                    onClick={clearImage}
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canReview}
                  onClick={() => run("review")}
                >
                  {busy && busy.kind === "review" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <ScanLine size={15} />
                  )}
                  {busy && busy.kind === "review" ? "Reviewing…" : "Review this chart"}
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <MandateMini guardrails={guardrails} />

            <section className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="label">Reading desk</span>
                <span
                  className={`h-1.5 w-1.5 ${keyReady ? "bg-long" : "bg-short"}`}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex items-start gap-2.5">
                <ShieldCheck size={15} className={keyReady ? "mt-0.5 text-accent" : "mt-0.5 text-faint"} strokeWidth={1.7} />
                <div>
                  <p className="text-[12.5px] text-bone">{PROVIDER_LABEL[provider]}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint">{model}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-[10.5px] text-faint">{keyLabel}</span>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-muted transition-colors hover:text-accent-bright"
                >
                  <Settings2 size={10} />
                  CHANGE
                </Link>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-faint">Risk budget</span>
                <span className="num text-[10.5px] text-muted">
                  {fmtUsd(guardrails.riskPerTradeUsd)} · {fmtPct(account.riskPerTradePct, 2)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-faint">Contract</span>
                <span className="num text-[10.5px] text-muted">
                  {instrument.contractSize} oz / lot
                </span>
              </div>
            </section>

            <section className="panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-[1px] w-4 bg-accent/70" aria-hidden="true" />
                <span className="label">Before you upload</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  "The price axis is visible and readable.",
                  "The instrument label says XAUUSD or GOLD.",
                  "The timeframe is on the chart.",
                  "No pop-up or watermark covers the last price.",
                ].map((item) => (
                  <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-faint">
                    <span className="mt-[7px] h-1 w-1 shrink-0 bg-accent" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-3 text-[10px] leading-relaxed text-faint">
                If the axis cannot be read, the desk will refuse. A crisp refusal is cheaper than a
                guessed level.
              </p>
            </section>

            <div className="flex items-start gap-2 px-1">
              <Lock size={11} className="mt-0.5 shrink-0 text-faint" />
              <p className="text-[10px] leading-relaxed text-faint">
                The screenshot is sent only to your selected provider. Provider keys are encrypted on
                the server and never reach the browser.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
