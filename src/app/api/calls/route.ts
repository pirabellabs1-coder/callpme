import { NextRequest } from "next/server";
import { requireOrgId } from "@/lib/db/context";
import { listCalls } from "@/lib/db/calls";
import { ok, serverError } from "@/lib/api/respond";
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

/** GET /api/calls — logs d'appels (filtres : agent, statut, direction, recherche). */
export async function GET(req: NextRequest) {
  try {
    const orgId = await requireOrgId();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const direction = sp.get("direction");
    const limit = sp.get("limit");

    const calls = await listCalls(orgId, {
      agentId: sp.get("agentId") || undefined,
      status:
        status && STATUSES.includes(status as CallStatus)
          ? (status as CallStatus)
          : undefined,
      direction:
        direction && DIRECTIONS.includes(direction as CallDirection)
          ? (direction as CallDirection)
          : undefined,
      search: sp.get("search")?.trim() || undefined,
      limit: limit ? Math.min(Number(limit) || 100, 500) : undefined,
    });
    return ok({ calls });
  } catch {
    return serverError();
  }
}
