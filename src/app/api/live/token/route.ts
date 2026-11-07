import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { createMonitorToken } from "@/lib/live/token";
import { forbidden, ok, unauthorized } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/live/token — ouvre la supervision des appels en direct.
 * Renvoie l'URL WebSocket du serveur vocal avec un jeton à usage unique
 * (60 s) limité à l'organisation du membre connecté. L'écoute, la consigne
 * soufflée et la reprise d'appel sont réservées aux administrateurs.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();
  const base = (process.env.VOICE_SERVER_URL || "").replace(/\/$/, "");
  if (!base) return forbidden("Le serveur vocal n'est pas encore configuré : aucun appel en direct à suivre.");
  const canControl = isOrgAdmin(session);
  const token = createMonitorToken({
    organizationId: session.org.id,
    userId: session.user.id,
    userName: session.user.name || session.user.email,
    canControl,
  });
  return ok(
    { url: `${base}/ws/monitor?t=${encodeURIComponent(token)}`, canControl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
