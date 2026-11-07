import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyInternal } from "@/lib/integrations/internal-bridge";
import { createGoogleEvent, deleteGoogleEvent, googleBusy } from "@/lib/integrations/google-calendar";
import { syncMissingGoogleEvents } from "@/lib/agenda/service";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("busy"), orgId: z.string().min(1).max(40), from: z.string().datetime(), to: z.string().datetime() }),
  z.object({
    op: z.literal("create"),
    orgId: z.string().min(1).max(40),
    ev: z.object({
      summary: z.string().max(300),
      description: z.string().max(3000),
      start: z.string().datetime(),
      end: z.string().datetime(),
      timezone: z.string().max(60),
    }),
  }),
  z.object({ op: z.literal("delete"), orgId: z.string().min(1).max(40), eventId: z.string().min(1).max(200) }),
  z.object({ op: z.literal("sync"), orgId: z.string().min(1).max(40) }),
]);

/**
 * POST /api/internal/google — opérations Google Agenda demandées par le serveur
 * vocal (qui n'a pas les identifiants OAuth). Signature HMAC obligatoire.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyInternal(req.headers.get("x-callpme-ts"), req.headers.get("x-callpme-sig"), raw)) {
    return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const d = parsed.data;
  if (d.op === "busy") {
    const busy = await googleBusy(d.orgId, new Date(d.from), new Date(d.to));
    return NextResponse.json({ busy: busy.map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString() })) });
  }
  if (d.op === "create") {
    const id = await createGoogleEvent(d.orgId, { ...d.ev, start: new Date(d.ev.start), end: new Date(d.ev.end) });
    return NextResponse.json({ id });
  }
  if (d.op === "sync") {
    return NextResponse.json(await syncMissingGoogleEvents(d.orgId));
  }
  await deleteGoogleEvent(d.orgId, d.eventId);
  return NextResponse.json({ ok: true });
}
