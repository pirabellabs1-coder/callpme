import { NextRequest } from "next/server";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { updateAgent } from "@/lib/db/agents";
import { widgetSchema } from "@/lib/widget/widget";
import { badRequest, ok, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** PUT /api/agents/:id/widget — réglages du bouton pour site web. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => null);
    const parsed = widgetSchema.safeParse(body?.widget);
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Réglages invalides.");
    const widget = { ...parsed.data, allowedDomains: Array.from(new Set(parsed.data.allowedDomains)) };
    if (widget.enabled && widget.allowedDomains.length === 0) {
      return badRequest("Indiquez au moins un domaine (ex. www.monsite.bj) pour activer le bouton.");
    }
    const agent = await updateAgent(access.agent.id, { config: { widget } });
    return ok({ widget: agent?.config.widget ?? widget });
  } catch {
    return serverError("Impossible d'enregistrer les réglages du site web.");
  }
}
