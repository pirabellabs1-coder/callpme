import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCallById, deleteCall } from "@/lib/db/calls";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/calls/:id — transcript complet d'un appel. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const call = await getCallById(params.id);
    return call ? ok({ call }) : notFound("Appel introuvable");
  } catch {
    return serverError();
  }
}

/** DELETE /api/calls/:id — supprime un appel de l'historique. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const removed = await deleteCall(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Appel introuvable");
  } catch {
    return serverError();
  }
}
