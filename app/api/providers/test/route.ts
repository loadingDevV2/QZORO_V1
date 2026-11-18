import { ProviderError, testProvider } from "@/lib/ai/providers";
import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import { PROVIDERS } from "@/lib/constants";
import { readSettings } from "@/lib/db";
import { resolveApiKey } from "@/lib/settings-service";
import type { DeskSettings, ProviderId } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the test as JSON." }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const provider = input.provider;
  if (!PROVIDERS.includes(provider as ProviderId)) {
    return Response.json({ error: "Choose a supported provider." }, { status: 400 });
  }

  let settings: DeskSettings;
  try {
    settings = await readSettings(session.user.id);
  } catch (error) {
    console.error("[providers] settings unavailable", error);
    return Response.json({ error: "The desk settings could not be loaded." }, { status: 500 });
  }

  const typedKey = typeof input.apiKey === "string" ? input.apiKey.trim().slice(0, 512) : "";
  const stored = resolveApiKey(provider as ProviderId, settings);
  const apiKey = typedKey || stored.key;
  if (!apiKey) {
    return Response.json({ error: "No key to test. Paste one first." }, { status: 400 });
  }

  const model =
    typeof input.model === "string" && input.model.trim()
      ? input.model.trim().slice(0, 80)
      : settings.models[provider as ProviderId];

  try {
    const result = await testProvider({ provider: provider as ProviderId, model, apiKey });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ProviderError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json(
      { error: "The test call failed. Check the key and model.", code: "test_failed" },
      { status: 502 },
    );
  }
}
