import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/dispatch";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const VALID_EVENTS = WEBHOOK_EVENTS.map((e) => e.id);

const schema = z.object({
  url: z.string().url("URL invalide").max(500),
  events: z.array(z.string()).min(1, "Sélectionnez au moins un événement"),
});

function serialize(w: {
  id: string;
  url: string;
  events: string;
  secret: string;
  enabled: boolean;
  lastStatus: number | null;
  lastDeliveryAt: Date | null;
  createdAt: Date;
}) {
  let events: string[] = [];
  try {
    events = JSON.parse(w.events);
  } catch {
    events = [];
  }
  return {
    id: w.id,
    url: w.url,
    events,
    secret: w.secret,
    enabled: w.enabled,
    lastStatus: w.lastStatus,
    lastDeliveryAt: w.lastDeliveryAt,
    createdAt: w.createdAt,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const hooks = await prisma.webhook.findMany({
    where: { organizationId: session.org.id },
    orderBy: { createdAt: "desc" },
  });
  return ok({ webhooks: hooks.map(serialize) });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message ?? "Données invalides",
      );
    }
    const events = parsed.data.events.filter((e) => VALID_EVENTS.includes(e as never));
    if (events.length === 0) return badRequest("Événements invalides");

    const webhook = await prisma.webhook.create({
      data: {
        organizationId: session.org.id,
        url: parsed.data.url,
        events: JSON.stringify(events),
        secret: `whsec_${randomBytes(16).toString("hex")}`,
        enabled: true,
      },
    });
    return created({ webhook: serialize(webhook) });
  } catch {
    return serverError("Impossible de créer le webhook");
  }
}
