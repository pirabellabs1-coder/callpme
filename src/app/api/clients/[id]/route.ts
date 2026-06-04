import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteClient } from "@/lib/db/clients";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const removed = await deleteClient(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Client introuvable");
  } catch {
    return serverError();
  }
}
