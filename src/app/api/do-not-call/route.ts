import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { addOptOuts } from "@/lib/campaigns/engine";
import { toE164 } from "@/lib/telephony/e164";
import { ok, badRequest, forbidden, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/do-not-call — numéros de la liste d'opposition (500 derniers). */
export async function GET() {
  try {
  const session = await getSession();
  if (!session) return unauthorized();
  const [rows, total] = await Promise.all([
    prisma.doNotCall.findMany({
      where: { organizationId: session.org.id },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { phone: true, reason: true, createdAt: true },
    }),
    prisma.doNotCall.count({ where: { organizationId: session.org.id } }),
  ]);
  return ok({ total, numbers: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch {
    return serverError();
  }
}

const addSchema = z.object({ phones: z.array(z.string().max(40)).min(1).max(5000), reason: z.string().max(200).optional() });

/** POST /api/do-not-call — ajoute des numéros (import ou saisie). */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const parsed = addSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Liste de numéros invalide.");
    const result = await addOptOuts(session.org.id, parsed.data.phones, parsed.data.reason ?? "Ajout manuel");
    return ok(result);
  } catch {
    return serverError();
  }
}

/** DELETE /api/do-not-call?phone=… — retire un numéro (sur demande expresse de la personne). */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    // Réautoriser l'appel d'une personne qui s'y est opposée : administrateurs seulement, et tracé.
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const phone = toE164(req.nextUrl.searchParams.get("phone") ?? "");
    if (!phone) return badRequest("Numéro invalide.");
    const res = await prisma.doNotCall.deleteMany({ where: { organizationId: session.org.id, phone } });
    if (res.count) console.info(`[opposition] ${phone} retiré par l'utilisateur ${session.user.id} (org ${session.org.id})`);
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
