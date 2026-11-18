import { AnalysisError, runAnalysis } from "@/lib/ai/analyze";
import { buildDemoAnalysis } from "@/lib/ai/demo";
import { enrichAnalysis } from "@/lib/ai/enrich";
import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import {
  ACCEPTED_IMAGE_TYPES,
  CHART_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  PROVIDER_LABEL,
} from "@/lib/constants";
import { insertAnalysis, listTrades, readSettings } from "@/lib/db";
import { computeGuardrails } from "@/lib/risk";
import { resolveApiKey } from "@/lib/settings-service";
import type { AnalysisRequestContext, DeskSettings, Guardrails } from "@/lib/types";

// Vercel Hobby allows 60s. Raise to 300 on Pro and align PROVIDER_TIMEOUT_MS.
export const maxDuration = 60;

function jsonError(message: string, status: number, code = "request_failed") {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function normalizeMime(type: string): string {
  return type === "image/jpg" ? "image/jpeg" : type;
}

async function loadDeskContext(
  userId: string,
): Promise<{ settings: DeskSettings; guardrails: Guardrails }> {
  const [settings, trades] = await Promise.all([readSettings(userId), listTrades(userId)]);
  return { settings, guardrails: computeGuardrails(trades, settings) };
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  const { supabase, user } = session;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("The upload could not be read. Send the chart as multipart form data.", 400);
  }

  let desk: { settings: DeskSettings; guardrails: Guardrails };
  try {
    desk = await loadDeskContext(user.id);
  } catch (error) {
    console.error("[analyze] desk context unavailable", error);
    return jsonError(
      "The desk settings could not be loaded. Check the server configuration and try again.",
      500,
      "settings_error",
    );
  }

  const { settings, guardrails } = desk;
  const demo = form.get("demo") === "true";
  const context: AnalysisRequestContext = {
    timeframe: String(form.get("timeframe") ?? "").slice(0, 20),
    session: String(form.get("session") ?? "").slice(0, 40),
    highImpactNews: form.get("highImpactNews") === "true",
    notes: String(form.get("notes") ?? "").trim().slice(0, 800),
  };

  if (demo) {
    return Response.json(
      {
        analysis: buildDemoAnalysis(settings, guardrails, context.session || "London"),
        meta: { demo: true, latencyMs: 0, repaired: false },
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const resolved = resolveApiKey(settings.provider, settings);
  if (!resolved.key) {
    return jsonError(
      `No ${PROVIDER_LABEL[settings.provider]} key on the desk. Add one in Settings, or run the sample review.`,
      400,
      "no_key",
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return jsonError("Attach a chart screenshot before running the review.", 400, "no_image");
  }
  if (file.size === 0) {
    return jsonError("The attached image is empty.", 400, "empty_image");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return jsonError(
      `The image is over ${MAX_IMAGE_MB} MB. Crop or compress the screenshot and try again.`,
      413,
      "too_large",
    );
  }

  const mimeType = normalizeMime(file.type);
  if (!ACCEPTED_IMAGE_TYPES.includes(mimeType)) {
    return jsonError("Use a PNG, JPEG, or WebP screenshot.", 415, "bad_type");
  }

  const id = crypto.randomUUID();
  const imagePath = `${user.id}/${id}.${extensionFor(mimeType)}`;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return jsonError("The attached image could not be read. Try another screenshot.", 400, "read_failed");
  }
  let uploaded = false;
  let filed = false;

  try {
    const { error: uploadError } = await supabase.storage.from(CHART_BUCKET).upload(
      imagePath,
      buffer,
      {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: false,
      },
    );
    if (uploadError) {
      console.error("[storage] chart upload failed", uploadError.message);
      return jsonError("The chart could not be stored. Try again.", 502, "upload_failed");
    }
    uploaded = true;

    const outcome = await runAnalysis({
      imageBase64: buffer.toString("base64"),
      mimeType,
      context,
      settings,
    });

    const record = enrichAnalysis(outcome.raw, settings, guardrails, {
      provider: outcome.provider,
      model: outcome.model,
      demo: false,
      timeframe: context.timeframe,
      session: context.session,
      notes: context.notes,
    });
    record.id = id;
    record.imageUrl = null;

    await insertAnalysis(user.id, {
      id,
      createdAt: record.createdAt,
      provider: outcome.provider,
      model: outcome.model,
      demo: false,
      timeframe: record.timeframe,
      record,
      imagePath,
      imageMime: mimeType,
    });
    filed = true;

    try {
      const { data: signed } = await supabase.storage
        .from(CHART_BUCKET)
        .createSignedUrl(imagePath, 60 * 60);
      record.imageUrl = signed?.signedUrl ?? null;
    } catch (error) {
      // The review is already filed. A missing preview URL is recoverable on
      // the next visit, so do not turn it into a failed review.
      console.warn("[storage] signed chart URL failed", error);
    }

    return Response.json(
      {
        analysis: record,
        meta: {
          demo: false,
          latencyMs: outcome.latencyMs,
          repaired: outcome.repaired,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    // No ticket was filed, so the chart should not be left orphaned in storage.
    if (uploaded && !filed) {
      try {
        const { error: removeError } = await supabase.storage.from(CHART_BUCKET).remove([imagePath]);
        if (removeError) console.warn("[storage] orphan cleanup failed", removeError.message);
      } catch (cleanupError) {
        console.warn("[storage] orphan cleanup failed", cleanupError);
      }
    }

    if (error instanceof AnalysisError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("[analyze] unexpected failure", error);
    return jsonError("The desk hit an unexpected error while reviewing the chart. Try again.", 500);
  }
}
