import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/auth/api-key";
import { listCalls } from "@/lib/db/calls";
import { ok, unauthorized } from "@/lib/api/respond";
import type { CallDirection, CallStatus } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

const STATUSES: CallStatus[] = [
  "completed",
  "transferred",
  "failed",
  "missed",
  "in_progress",
];
const DIRECTIONS: CallDirection[] = ["inbound", "outbound"];

/** GET /api/v1/calls — liste les appels (auth par clé API). */
export async function GET(req: NextRequest) {
  const org = await authenticateApiKey(req);
  if (!org) return unauthorized("Clé API invalide ou manquante");

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const direction = sp.get("direction");
  const limit = sp.get("limit");

  const calls = await listCalls(org.id, {
    agentId: sp.get("agentId") || undefined,
    status:
      status && STATUSES.includes(status as CallStatus)
        ? (status as CallStatus)
        : undefined,
    direction:
      direction && DIRECTIONS.includes(direction as CallDirection)
        ? (direction as CallDirection)
        : undefined,
    limit: limit ? Math.min(Number(limit) || 100, 500) : undefined,
  });
  return ok({ data: calls });
}
