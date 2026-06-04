import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { signPayload } from "@/lib/webhooks/dispatch";
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/dev/functions/:id/test
 * Envoie réellement un exemple d'arguments vers l'URL de destination de la
 * fonction (signé HMAC), pour valider l'intégration façon Vapi.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const tool = await prisma.customTool.findUnique({ where: { id: params.id } });
    if (!tool || tool.organizationId !== session.org.id) {
      return notFound("Fonction introuvable");
    }
    if (!tool.serverUrl) {
      return badRequest("Aucune URL de destination configurée pour cette fonction.");
    }

    // Exemple d'arguments à partir du schéma
    let props: Record<string, { type?: string }> = {};
    try {
      props = JSON.parse(tool.parameters).properties ?? {};
    } catch {
      props = {};
    }
    const sample: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(props)) {
      sample[key] =
        def.type === "number" || def.type === "integer"
          ? 42
          : def.type === "boolean"
            ? true
            : `exemple_${key}`;
    }

    const payload = JSON.stringify({
      tool: tool.name,
      arguments: sample,
      test: true,
      timestamp: new Date().toISOString(),
    });
    const signature = tool.secret ? signPayload(tool.secret, payload) : "";

    let status: number | null = null;
    try {
      const res = await fetch(tool.serverUrl, {
        method: tool.method || "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Callpme-Function": tool.name,
          "X-Callpme-Signature": signature,
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });
      status = res.status;
    } catch {
      status = null;
    }

    return ok({
      status,
      delivered: status !== null && status >= 200 && status < 300,
      sample,
    });
  } catch {
    return serverError();
  }
}
