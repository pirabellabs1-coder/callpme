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
  toE164,
  verifyTelnyxSignature,
  verifyTwilioSignature,
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

  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  const publicUrl = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const valid =
    provider === "twilio"
      ? verifyTwilioSignature(`${publicUrl}/api/telephony/inbound`, params, req.headers.get("x-twilio-signature"))
      : verifyTelnyxSignature(raw, req.headers.get("telnyx-signature-ed25519"), req.headers.get("telnyx-timestamp"));
  if (!valid) return xml(sayAndHangup("Requête refusée."), 403);

  if (!telephonyConfigured()) {
    return xml(sayAndHangup("Le service vocal est momentanément indisponible. Merci de rappeler plus tard."));
  }

  const to = toE164(params.To ?? params.to ?? "");
  const from = toE164(params.From ?? params.from ?? "") ?? "inconnu";
  if (!to) return xml(sayAndHangup("Numéro inconnu."));

  // Numéros stockés avec ou sans espaces : comparaison au format E.164.
  const candidates = await prisma.agent.findMany({
    where: { phoneNumber: { not: null }, status: "active" },
    select: { id: true, phoneNumber: true },
  });
  const match = candidates.find((a) => toE164(a.phoneNumber ?? "") === to);
  const agent = match ? await getAgentById(match.id) : null;
  if (!agent) return xml(sayAndHangup("Ce numéro n'est pas attribué pour le moment."));

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
  });
  return xml(streamInstructions(token));
}
