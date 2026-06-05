import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { deleteClient, updateClient } from "@/lib/db/clients";
import { ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  brandColor: z.string().max(20).nullable().optional(),
  contactEmail: z.string().max(120).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const updated = await updateClient(session.org.id, params.id, parsed.data);
    return updated ? ok({ success: true }) : notFound("Client introuvable");
  } catch {
    return serverError();
  }
}

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
