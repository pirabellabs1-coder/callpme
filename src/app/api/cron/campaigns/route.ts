import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { tickCampaigns } from "@/lib/campaigns/engine";

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
 * GET /api/cron/campaigns — un tour du moteur de campagnes (appelé par le
 * cron de l'hébergeur, avec « Authorization: Bearer CRON_SECRET »). Le serveur
 * vocal fait déjà ce tour toutes les 30 s : cette route sert de relais.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const reports = await tickCampaigns();
  return Response.json({ ok: true, campaigns: reports.length, placed: reports.reduce((n, r) => n + r.placed, 0) });
}
