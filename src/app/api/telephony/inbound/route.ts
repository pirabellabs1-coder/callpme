import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAgentById } from "@/lib/db/agents";
import { canUseMinutes } from "@/lib/billing/limits";
import { createVoiceToken } from "@/lib/voice-engine/token";
import {
  sayAndHangup,
  streamInstructions,
  telephonyConfigured,
  telephonyProvider,
  readSignedWebhook,
  toE164,
} from "@/lib/telephony/provider";

export const dynamic = "force-dynamic";

function xml(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

/**
 * POST /api/telephony/inbound — webhook « appel entrant » de l'opérateur
 * (Twilio Voice URL ou application TeXML Telnyx).
 *
 * 1. Vérifie la signature de l'opérateur (sinon 403 : personne d'autre ne peut
 *    ouvrir une session vocale à nos frais).
 * 2. Retrouve l'agent actif rattaché au numéro appelé.
 * 3. Vérifie le quota de l'offre, puis relie l'appel au serveur vocal.
 */
export async function POST(req: NextRequest) {
  const provider = telephonyProvider();
  if (!provider) return xml(sayAndHangup("Ce service n'est pas disponible."), 503);

  const params = await readSignedWebhook(req, "/api/telephony/inbound");
  if (!params) return xml(sayAndHangup("Requête refusée."), 403);

  if (!telephonyConfigured()) {
    return xml(sayAndHangup("Le service vocal est momentanément indisponible. Merci de rappeler plus tard."));
  }

  const to = toE164(params.To ?? params.to ?? "");
  const from = toE164(params.From ?? params.from ?? "") ?? "inconnu";
  if (!to) return xml(sayAndHangup("Numéro inconnu."));

  // Le numéro doit appartenir (vérifié) à une organisation, et l'agent à cette
  // même organisation : personne ne peut détourner les appels d'un autre client.
  const owned = await prisma.phoneNumber.findUnique({
    where: { number: to },
    select: { organizationId: true, status: true },
  });
  const match =
    owned && owned.status === "active"
      ? await prisma.agent.findFirst({
          where: { phoneNumber: to, organizationId: owned.organizationId, status: "active" },
          select: { id: true },
        })
      : null;
  const agent = match ? await getAgentById(match.id) : null;
  if (!agent) return xml(sayAndHangup("Ce numéro n'est pas attribué pour le moment."));

  // Identifiant d'appel de l'opérateur : lié au jeton, le serveur vocal
  // refusera un flux qui en annonce un autre.
  const providerCallId = params.CallSid ?? params.call_control_id ?? params.CallControlId;
  if (!providerCallId) return xml(sayAndHangup("Requête refusée."), 400);

  const org = await prisma.organization.findUnique({ where: { id: agent.organizationId }, select: { plan: true } });
  const quota = await canUseMinutes(agent.organizationId, org?.plan ?? "starter");
  if (!quota.ok) return xml(sayAndHangup("Ce service est momentanément indisponible. Merci de rappeler plus tard."));

  const token = createVoiceToken({
    callId: `in_${Date.now().toString(36)}`,
    agentId: agent.id,
    organizationId: agent.organizationId,
    direction: "inbound",
    from,
    to,
    providerCallId,
  });
  return xml(streamInstructions(token));
}
