import { NextRequest } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { deletePhoneNumber } from "@/lib/db/numbers";
import { ok, unauthorized, notFound, serverError, forbidden } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const removed = await deletePhoneNumber(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Numéro introuvable");
  } catch (e) {
    return serverError(e instanceof Error && e.message.startsWith("Libération") ? e.message : undefined);
  }
}
