import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { runCampaign } from "@/lib/db/campaigns";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/campaigns/:id/run — lance le dialer (simulé). */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const result = await runCampaign(session.org.id, params.id);
    return result ? ok(result) : notFound("Campagne introuvable");
  } catch {
    return serverError("Impossible de lancer la campagne");
  }
}
