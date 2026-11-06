import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendExpiryReminders } from "@/lib/billing/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET /api/cron/reminders — rappels d'échéance (tâche quotidienne de l'hébergeur). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const report = await sendExpiryReminders();
  return Response.json({ ok: true, ...report });
}
