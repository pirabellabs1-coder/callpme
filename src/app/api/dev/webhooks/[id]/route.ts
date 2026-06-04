import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const patchSchema = z.object({ enabled: z.boolean() });

async function owned(orgId: string, id: string) {
  const hook = await prisma.webhook.findUnique({ where: { id } });
  return hook && hook.organizationId === orgId ? hook : null;
}

/** PATCH /api/dev/webhooks/:id — active / désactive. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!(await owned(session.org.id, params.id)))
      return notFound("Webhook introuvable");

    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");

    await prisma.webhook.update({
      where: { id: params.id },
      data: { enabled: parsed.data.enabled },
    });
    return ok({ success: true });
  } catch {
    return serverError();
  }
}

/** DELETE /api/dev/webhooks/:id */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!(await owned(session.org.id, params.id)))
      return notFound("Webhook introuvable");
    await prisma.webhook.delete({ where: { id: params.id } });
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
