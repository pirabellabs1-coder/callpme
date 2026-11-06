import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ok, notFound, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/scenarios/:id — supprime un scénario (et son historique). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const res = await prisma.testScenario.deleteMany({ where: { id: params.id, organizationId: session.org.id } });
    return res.count ? ok({ success: true }) : notFound("Scénario introuvable");
  } catch {
    return serverError();
  }
}
