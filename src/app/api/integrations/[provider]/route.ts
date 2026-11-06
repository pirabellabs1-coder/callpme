import { NextRequest } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { disconnectIntegration } from "@/lib/db/integrations";
import { revokeGoogleCalendar } from "@/lib/integrations/google-calendar";
import { ok, unauthorized, serverError, forbidden } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    if (params.provider === "google_calendar") await revokeGoogleCalendar(session.org.id);
    await disconnectIntegration(session.org.id, params.provider);
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
