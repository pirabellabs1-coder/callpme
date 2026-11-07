import { NextRequest } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/security/rate-limit";
import { diagnoseNumber } from "@/lib/telephony/diagnostics";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/numbers/:id/diagnostic — vérifie tout ce qui fait marcher ce numéro (lecture seule). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    if (isRateLimited(`numdiag:${session.org.id}`, 30, 60 * 60_000)) return badRequest("Trop de vérifications. Réessayez plus tard.");
    const diag = await diagnoseNumber(session.org.id, params.id);
    return diag ? ok({ diagnostic: diag }) : notFound("Numéro introuvable");
  } catch {
    return serverError("Vérification impossible.");
  }
}
