/**
 * Routage d'un appel entrant vers l'agent du numéro appelé — commun à
 * Twilio, Telnyx et la passerelle SIP.
 *
 * Le numéro doit appartenir (vérifié, « actif ») à une organisation, et
 * l'agent à cette même organisation : personne ne peut détourner les appels
 * d'un autre client. Le quota de minutes de l'offre est vérifié.
 */
import { prisma } from "../db/client";
import { getAgentById } from "../db/agents";
import { canUseMinutes } from "../billing/limits";
import type { Agent } from "../shared/types";

export type InboundRoute =
  | { ok: true; agent: Agent }
  | { ok: false; reason: "unassigned" | "quota" };

/** Agent actif rattaché à un numéro de la plateforme (sans vérifier le quota). */
export async function agentForNumber(to: string): Promise<Agent | null> {
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
  return match ? await getAgentById(match.id) : null;
}

export async function routeInbound(to: string): Promise<InboundRoute> {
  const agent = await agentForNumber(to);
  if (!agent) return { ok: false, reason: "unassigned" };
  const org = await prisma.organization.findUnique({ where: { id: agent.organizationId }, select: { plan: true } });
  const quota = await canUseMinutes(agent.organizationId, org?.plan ?? "starter");
  if (!quota.ok) return { ok: false, reason: "quota" };
  return { ok: true, agent };
}
