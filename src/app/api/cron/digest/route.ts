import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { tickDigests } from "@/lib/digest/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET /api/cron/digest — un tour des résumés quotidiens (« Authorization:
 * Bearer CRON_SECRET »). À appeler toutes les heures (cron Vercel Pro ou
 * service externe) ; le serveur vocal fait déjà ce tour toutes les 5 min.
 * Chaque organisation ne reçoit qu'un résumé par jour, à son heure locale.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  return Response.json({ ok: true, ...(await tickDigests()) });
}
