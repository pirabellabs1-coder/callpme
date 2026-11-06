/**
 * Résultats par agent (et par client d'agence) sur une période : appels,
 * minutes, résolution, transferts, rendez-vous pris, prospects collectés.
 */
import { prisma } from "./client";

export interface AgentOutcome {
  agentId: string;
  agentName: string;
  clientId: string | null;
  calls: number;
  minutes: number;
  resolved: number;
  transferred: number;
  appointments: number;
  leads: number;
}

export async function outcomesByAgent(orgId: string, since: Date): Promise<AgentOutcome[]> {
  const agents = await prisma.agent.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, clientId: true },
  });
  if (agents.length === 0) return [];
  const ids = agents.map((a) => a.id);
  const [byStatus, appts, leads] = await Promise.all([
    prisma.call.groupBy({
      by: ["agentId", "status"],
      where: { agentId: { in: ids }, createdAt: { gte: since } },
      _count: true,
      _sum: { durationSec: true },
    }),
    prisma.appointment.groupBy({
      by: ["agentId"],
      where: { organizationId: orgId, isTest: false, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["agentId"],
      where: { organizationId: orgId, isTest: false, kind: "lead", createdAt: { gte: since } },
      _count: true,
    }),
  ]);

  return agents
    .map((a) => {
      const rows = byStatus.filter((r) => r.agentId === a.id);
      const count = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
      return {
        agentId: a.id,
        agentName: a.name,
        clientId: a.clientId,
        calls: rows.reduce((n, r) => n + r._count, 0),
        minutes: Math.round(rows.reduce((n, r) => n + (r._sum.durationSec ?? 0), 0) / 60),
        resolved: count("completed"),
        transferred: count("transferred"),
        appointments: appts.find((r) => r.agentId === a.id)?._count ?? 0,
        leads: leads.find((r) => r.agentId === a.id)?._count ?? 0,
      };
    })
    .sort((x, y) => y.calls - x.calls);
}

export interface ClientUsage {
  clientId: string | null;
  calls: number;
  minutes: number;
  appointments: number;
  leads: number;
  agents: number;
}

/** Agrégat par client d'agence (null = agents non rattachés). */
export function usageByClient(rows: AgentOutcome[]): ClientUsage[] {
  const map = new Map<string | null, ClientUsage>();
  for (const r of rows) {
    const u = map.get(r.clientId) ?? { clientId: r.clientId, calls: 0, minutes: 0, appointments: 0, leads: 0, agents: 0 };
    u.calls += r.calls;
    u.minutes += r.minutes;
    u.appointments += r.appointments;
    u.leads += r.leads;
    u.agents += 1;
    map.set(r.clientId, u);
  }
  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
