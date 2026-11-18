import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import { createTrade, getAnalysis, hasTradeForAnalysis, listTrades, readSettings } from "@/lib/db";
import { deskDateKey } from "@/lib/desk-time";
import { buildTrade, parseTradeDraft } from "@/lib/trade-service";

export const maxDuration = 60;

export async function GET() {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  try {
    return Response.json(
      { trades: await listTrades(session.user.id) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[trades] read failed", error);
    return Response.json({ error: "The ledger could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the trade as JSON." }, { status: 400 });
  }

  try {
    const settings = await readSettings(session.user.id);
    const draft = parseTradeDraft(body, deskDateKey());
    if ("error" in draft) {
      return Response.json({ error: draft.error }, { status: 400 });
    }

    if (draft.source === "sample") {
      return Response.json(
        { error: "The sample review is a worked example, not a trade. Nothing is logged from it." },
        { status: 400 },
      );
    }

    if (draft.analysisId) {
      const analysis = await getAnalysis(session.user.id, draft.analysisId);
      if (!analysis) {
        return Response.json({ error: "That review is not on file." }, { status: 400 });
      }
      if (analysis.demo) {
        return Response.json(
          { error: "The sample review is a worked example, not a trade. Nothing is logged from it." },
          { status: 400 },
        );
      }
      if (analysis.verdict !== "cleared") {
        return Response.json(
          { error: "Only a cleared review can be logged. This ticket did not clear the desk." },
          { status: 400 },
        );
      }
      if (await hasTradeForAnalysis(session.user.id, draft.analysisId)) {
        return Response.json({ error: "This review is already in the ledger." }, { status: 409 });
      }
    }

    const built = buildTrade(draft, settings);
    if (!built.ok || !built.trade) {
      return Response.json({ error: built.error ?? "The trade could not be priced." }, { status: 400 });
    }

    const trade = await createTrade(session.user.id, built.trade);
    return Response.json({ trade }, { status: 201 });
  } catch (error) {
    console.error("[trades] write failed", error);
    return Response.json({ error: "The trade could not be saved." }, { status: 500 });
  }
}
