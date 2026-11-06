import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { LEAD_STATUSES } from "@/lib/db/appointments";
import { ok, badRequest, notFound, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(LEAD_STATUSES) });

/** PATCH /api/leads/:id — change le statut de suivi d'une fiche. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Statut invalide");
    const res = await prisma.lead.updateMany({
      where: { id: params.id, organizationId: session.org.id },
      data: { status: parsed.data.status },
    });
    return res.count ? ok({ success: true }) : notFound("Fiche introuvable");
  } catch {
    return serverError();
  }
}

/** DELETE /api/leads/:id — supprime une fiche (droit à l'effacement). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const res = await prisma.lead.deleteMany({ where: { id: params.id, organizationId: session.org.id } });
    return res.count ? ok({ success: true }) : notFound("Fiche introuvable");
  } catch {
    return serverError();
  }
}
