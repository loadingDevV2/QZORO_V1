import { requireApiSession, unauthorizedResponse } from "@/lib/auth";
import { deleteTrade, getTrade, readSettings, updateTrade } from "@/lib/db";
import { applyTradeUpdate } from "@/lib/trade-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Params) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the update as JSON." }, { status: 400 });
  }

  try {
    const existing = await getTrade(session.user.id, id);
    if (!existing) {
      return Response.json({ error: "That trade is not in the ledger." }, { status: 404 });
    }

    const settings = await readSettings(session.user.id);
    const built = applyTradeUpdate(existing, body, settings);
    if (!built.ok || !built.trade) {
      return Response.json({ error: built.error ?? "The update could not be priced." }, { status: 400 });
    }

    const trade = await updateTrade(session.user.id, id, built.trade);
    if (!trade) {
      return Response.json({ error: "That trade is not in the ledger." }, { status: 404 });
    }
    return Response.json({ trade });
  } catch (error) {
    console.error("[trades] update failed", error);
    return Response.json({ error: "The trade could not be updated." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Params) {
  const session = await requireApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = await ctx.params;
  try {
    const removed = await deleteTrade(session.user.id, id);
    if (!removed) {
      return Response.json({ error: "That trade is not in the ledger." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[trades] delete failed", error);
    return Response.json({ error: "The trade could not be deleted." }, { status: 500 });
  }
}
