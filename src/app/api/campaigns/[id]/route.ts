import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { setCampaignStatus, deleteCampaign } from "@/lib/db/campaigns";
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["draft", "running", "paused", "completed"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Statut invalide");
    const okSet = await setCampaignStatus(session.org.id, params.id, parsed.data.status);
    return okSet ? ok({ success: true }) : notFound("Campagne introuvable");
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
    const removed = await deleteCampaign(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Campagne introuvable");
  } catch {
    return serverError();
  }
}
