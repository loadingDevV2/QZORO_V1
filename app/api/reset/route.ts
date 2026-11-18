import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import { clearJournal } from "@/lib/db";

// Storage cleanup for a large journal can outlive the default function limit.
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the confirmation as JSON." }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  if (input.confirm !== "RESET") {
    return Response.json({ error: "Type RESET to clear the journal." }, { status: 400 });
  }

  try {
    await clearJournal();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[reset] clear failed", error);
    return Response.json({ error: "The journal could not be cleared." }, { status: 500 });
  }
}
