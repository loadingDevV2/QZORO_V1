import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/db";
import { applySettingsPatch, toClientSettings } from "@/lib/settings-service";

function failure(message: string, error: unknown) {
  console.error("[settings] request failed", error);
  return Response.json(
    { error: message },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function GET() {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  try {
    const settings = await readSettings(session.user.id);
    return Response.json(
      { settings: toClientSettings(settings) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return failure("The desk settings could not be loaded.", error);
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send settings as JSON." }, { status: 400 });
  }

  try {
    const existing = await readSettings(session.user.id);
    const next = applySettingsPatch(existing, body);
    const saved = await writeSettings(session.user.id, next);
    return Response.json(
      { settings: toClientSettings(saved) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return failure(
      "The settings could not be saved. Check the server encryption configuration and try again.",
      error,
    );
  }
}
