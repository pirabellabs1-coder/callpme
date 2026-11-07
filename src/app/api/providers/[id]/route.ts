import { NextRequest } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { deleteProvider } from "@/lib/db/numbers";
import { ok, unauthorized, notFound, serverError, forbidden, badRequest } from "@/lib/api/respond";
import { prisma } from "@/lib/db/client";
import { validSmsSender } from "@/lib/telephony/sms";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const removed = await deleteProvider(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Opérateur introuvable");
  } catch {
    return serverError();
  }
}

/** PATCH /api/providers/:id — expéditeur des SMS (numéro SMS ou nom de 3 à 11 caractères). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const body = (await req.json().catch(() => null)) as { smsSender?: unknown } | null;
    const raw = typeof body?.smsSender === "string" ? body.smsSender.trim() : "";
    if (raw && !validSmsSender(raw)) {
      return badRequest("Expéditeur invalide : un numéro au format +33…, ou un nom de 3 à 11 lettres/chiffres (ex. CABINET).");
    }
    const done = await prisma.providerConnection.updateMany({
      where: { id: params.id, organizationId: session.org.id },
      data: { smsSender: raw || null },
    });
    return done.count === 1 ? ok({ smsSender: raw || null }) : notFound("Opérateur introuvable");
  } catch {
    return serverError();
  }
}
