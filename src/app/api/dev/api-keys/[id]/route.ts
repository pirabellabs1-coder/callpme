import { NextRequest } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ok, unauthorized, notFound, serverError, forbidden } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/dev/api-keys/:id — révoque (supprime) une clé. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const key = await prisma.apiKey.findUnique({ where: { id: params.id } });
    if (!key || key.organizationId !== session.org.id) {
      return notFound("Clé introuvable");
    }
    await prisma.apiKey.delete({ where: { id: params.id } });
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
