import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createCampaign } from "@/lib/db/campaigns";
import { created, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80),
  agentId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const campaign = await createCampaign(session.org.id, parsed.data);
    if (!campaign) return badRequest("Agent invalide");
    return created({ campaign: { id: campaign.id } });
  } catch {
    return serverError();
  }
}
