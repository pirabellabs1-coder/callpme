/**
 * Données du portail client d'une agence : TOUJOURS limitées aux agents de
 * ce client (et de son agence). Aucune autre donnée n'est lisible.
 */
import { prisma } from "@/lib/db/client";
import type { ClientSessionContext } from "@/lib/auth/session";

export async function clientAgentIds(s: ClientSessionContext): Promise<string[]> {
  const agents = await prisma.agent.findMany({
    where: { organizationId: s.org.id, clientId: s.client.id },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}

/**
 * Appels du client : rattachés à lui au moment de l'appel (un agent
 * réattribué n'emporte pas l'historique de son ancien client), et passés par
 * un agent de l'agence.
 */
function callScope(s: ClientSessionContext, orgAgentIds: string[]) {
  return { clientId: s.client.id, agentId: { in: orgAgentIds } };
}

/** Tous les agents de l'agence (le rattachement au client est porté par chaque appel). */
async function orgAgentIds(s: ClientSessionContext): Promise<string[]> {
  const agents = await prisma.agent.findMany({ where: { organizationId: s.org.id }, select: { id: true } });
  return agents.map((a) => a.id);
}

export async function clientStats(s: ClientSessionContext, since: Date) {
  const agentsOfClient = await clientAgentIds(s);
  const ids = await orgAgentIds(s);
  if (!ids.length) return { agents: 0, calls: 0, minutes: 0, appointments: 0, leads: 0, transferred: 0 };
  const [calls, minutes, appointments, leads, transferred] = await Promise.all([
    prisma.call.count({ where: { ...callScope(s, ids), createdAt: { gte: since } } }),
    prisma.call.aggregate({ where: { ...callScope(s, ids), createdAt: { gte: since } }, _sum: { durationSec: true } }),
    prisma.appointment.count({ where: { organizationId: s.org.id, clientId: s.client.id, isTest: false, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: s.org.id, clientId: s.client.id, isTest: false, createdAt: { gte: since } } }),
    prisma.call.count({ where: { ...callScope(s, ids), status: "transferred", createdAt: { gte: since } } }),
  ]);
  return {
    agents: agentsOfClient.length,
    calls,
    minutes: Math.round((minutes._sum.durationSec ?? 0) / 60),
    appointments,
    leads,
    transferred,
  };
}

export async function clientCalls(s: ClientSessionContext, take = 50) {
  const ids = await orgAgentIds(s);
  if (!ids.length) return [];
  return prisma.call.findMany({
    where: callScope(s, ids),
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      direction: true,
      fromNumber: true,
      toNumber: true,
      status: true,
      durationSec: true,
      summary: true,
      outcome: true,
      createdAt: true,
      agent: { select: { name: true } },
    },
  });
}

export async function clientCall(s: ClientSessionContext, id: string) {
  const ids = await orgAgentIds(s);
  if (!ids.length) return null;
  return prisma.call.findFirst({
    where: { id, ...callScope(s, ids) },
    select: {
      id: true,
      direction: true,
      fromNumber: true,
      toNumber: true,
      status: true,
      durationSec: true,
      summary: true,
      outcome: true,
      transcript: true,
      createdAt: true,
      agent: { select: { name: true } },
    },
  });
}

export async function clientAppointments(s: ClientSessionContext) {
  return prisma.appointment.findMany({
    where: { organizationId: s.org.id, clientId: s.client.id, isTest: false, startsAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: { id: true, reference: true, customerName: true, customerPhone: true, startsAt: true, status: true },
  });
}

export async function clientLeads(s: ClientSessionContext) {
  return prisma.lead.findMany({
    where: { organizationId: s.org.id, clientId: s.client.id, isTest: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, phone: true, kind: true, notes: true, status: true, createdAt: true },
  });
}
