/**
 * Contrôle d'accès des routes /api/agents/:id — exige une session et vérifie
 * que l'agent appartient à l'organisation courante. Un agent d'une autre
 * organisation renvoie 404 (on ne révèle pas son existence).
 */
import { getSession, type SessionContext } from "../auth/session";
import { getAgentById } from "../db/agents";
import { notFound, unauthorized } from "./respond";
import type { Agent } from "../shared/types";

export type OwnedAgent =
  | { ok: true; session: SessionContext; agent: Agent }
  | { ok: false; response: Response };

export async function requireOwnedAgent(id: string): Promise<OwnedAgent> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  const agent = await getAgentById(id);
  if (!agent || agent.organizationId !== session.org.id) {
    return { ok: false, response: notFound("Agent introuvable") };
  }
  return { ok: true, session, agent };
}
