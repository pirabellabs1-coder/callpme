import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { deliver } from "@/lib/webhooks/dispatch";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/dev/webhooks/:id/test — envoie réellement un événement « ping ». */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const hook = await prisma.webhook.findUnique({ where: { id: params.id } });
    if (!hook || hook.organizationId !== session.org.id) {
      return notFound("Webhook introuvable");
    }
    const status = await deliver(
      { id: hook.id, url: hook.url, secret: hook.secret },
      "ping",
      {
        message: "Webhook de test depuis Callpme",
        organization: session.org.name,
      },
    );
    return ok({
      status,
      delivered: status !== null && status >= 200 && status < 300,
    });
  } catch {
    return serverError();
  }
}
