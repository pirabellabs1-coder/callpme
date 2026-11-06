import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAgentById } from "@/lib/db/agents";
import { gatewayAuthorized } from "@/lib/telephony/sip";
import { recordContactOutcome } from "@/lib/campaigns/engine";

export const dynamic = "force-dynamic";

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** Issues de composition Asterisk (DIALSTATUS) qui veulent dire « pas joint ». */
const EVENT_GRACE_MS = 10 * 60_000;

const NOT_CONNECTED: Record<string, "no_answer" | "failed"> = {
  NOANSWER: "no_answer",
  BUSY: "no_answer",
  CANCEL: "no_answer",
  CONGESTION: "failed",
  CHANUNAVAIL: "failed",
};

/**
 * GET /api/telephony/sip/event?uuid=…&type=… — événements d'un appel
 * sortant, envoyés par le plan de numérotation Asterisk :
 *  - type=answered&amd=HUMAN|MACHINE|NOTSURE → « CONNECT » ou « HANGUP »
 *    (répondeur : message laissé par l'agent, ou raccroché, selon son réglage) ;
 *  - type=dial&status=NOANSWER|BUSY|… → contact de campagne mis à jour.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (!gatewayAuthorized(req.headers, p)) return text("HANGUP", 403);
  const uuid = p.get("uuid") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return text("HANGUP", 400);
  const session = await prisma.sipSession.findUnique({ where: { id: uuid } });
  if (!session || session.direction !== "outbound") return text("HANGUP", 404);
  // Les événements arrivent pendant la sonnerie ou juste après : pas de rejeu tardif.
  if (session.expiresAt.getTime() + EVENT_GRACE_MS < Date.now()) return text("HANGUP", 410);
  let metadata: Record<string, string> = {};
  try {
    metadata = session.metadata ? JSON.parse(session.metadata) : {};
  } catch {
    metadata = {};
  }

  if (p.get("type") === "answered") {
    if ((p.get("amd") ?? "").toUpperCase() !== "MACHINE") return text("CONNECT");
    const agent = await getAgentById(session.agentId);
    const action = agent?.config.voicemail?.action ?? "message";
    if (action === "off") return text("CONNECT");
    if (action === "hangup" || !agent) {
      if (metadata.contactId) await recordContactOutcome({ contactId: metadata.contactId, organizationId: session.organizationId }, "voicemail", "Répondeur");
      return text("HANGUP");
    }
    // Message sur répondeur : la session vocale le lira puis raccrochera.
    await prisma.sipSession.update({ where: { id: uuid }, data: { metadata: JSON.stringify({ ...metadata, voicemail: "1" }) } });
    return text("CONNECT");
  }

  if (p.get("type") === "dial") {
    const outcome = NOT_CONNECTED[(p.get("status") ?? "").toUpperCase()];
    if (outcome && metadata.contactId) {
      await recordContactOutcome(
        { contactId: metadata.contactId, organizationId: session.organizationId },
        outcome,
        outcome === "no_answer" ? "Pas de réponse" : "Appel en échec",
      );
    }
    return text("OK");
  }
  return text("HANGUP", 400);
}
