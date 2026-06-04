/**
 * Requêtes du centre de contrôle plateforme (super-admin).
 * Aucune restriction par organisation : vue globale du site.
 */
import { prisma } from "./client";

export async function getPlatformStats() {
  const [orgs, users, agents, calls, activeAgents, plans] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.agent.count(),
    prisma.call.count(),
    prisma.agent.count({ where: { status: "active" } }),
    prisma.organization.groupBy({ by: ["plan"], _count: { _all: true } }),
  ]);
  const byPlan: Record<string, number> = { starter: 0, pro: 0, agency: 0 };
  for (const p of plans) byPlan[p.plan] = p._count._all;
  // Revenu mensuel estimé (49 / 149 / 0 sur devis)
  const mrr = byPlan.starter * 49 + byPlan.pro * 149;
  return { orgs, users, agents, calls, activeAgents, byPlan, mrr };
}

/** Prix mensuel par offre. Agency = « sur devis » → 0 € de MRR fixe (revenu suivi à part). */
const PLAN_PRICE: Record<string, number> = { starter: 49, pro: 149, agency: 0 };

export interface PlatformAnalytics {
  mrr: number;
  arr: number;
  orgs: number;
  users: number;
  agents: number;
  activeAgents: number;
  calls: number;
  voices: number;
  byPlan: { plan: string; count: number; mrr: number }[];
  months: {
    label: string;
    orgs: number;
    users: number;
    calls: number;
    mrr: number;
  }[];
  statusBreakdown: { status: string; count: number }[];
  topOrgs: { name: string; plan: string; calls: number }[];
}

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const [orgs, users, calls, agents, voiceCount, callsByAgent] =
    await Promise.all([
      prisma.organization.findMany({
        select: { id: true, name: true, plan: true, createdAt: true },
      }),
      prisma.user.findMany({ select: { createdAt: true } }),
      prisma.call.findMany({ select: { createdAt: true, status: true } }),
      prisma.agent.findMany({
        select: { status: true, organizationId: true },
      }),
      prisma.voice.count(),
      prisma.agent.findMany({
        select: { organizationId: true, _count: { select: { calls: true } } },
      }),
    ]);

  const byPlanCount: Record<string, number> = { starter: 0, pro: 0, agency: 0 };
  for (const o of orgs) byPlanCount[o.plan] = (byPlanCount[o.plan] ?? 0) + 1;
  const mrr = orgs.reduce((s, o) => s + (PLAN_PRICE[o.plan] ?? 0), 0);

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      label: monthFmt.format(start),
      orgs: orgs.filter((o) => o.createdAt >= start && o.createdAt < end).length,
      users: users.filter((u) => u.createdAt >= start && u.createdAt < end).length,
      calls: calls.filter((c) => c.createdAt >= start && c.createdAt < end).length,
      // MRR cumulé à la fin du mois (orgs existantes × prix de l'offre)
      mrr: orgs
        .filter((o) => o.createdAt < end)
        .reduce((s, o) => s + (PLAN_PRICE[o.plan] ?? 0), 0),
    });
  }

  const statuses = ["completed", "transferred", "missed", "failed", "in_progress"];
  const statusBreakdown = statuses
    .map((status) => ({
      status,
      count: calls.filter((c) => c.status === status).length,
    }))
    .filter((s) => s.count > 0);

  const callsByOrg = new Map<string, number>();
  for (const a of callsByAgent) {
    callsByOrg.set(
      a.organizationId,
      (callsByOrg.get(a.organizationId) ?? 0) + a._count.calls,
    );
  }
  const topOrgs = orgs
    .map((o) => ({ name: o.name, plan: o.plan, calls: callsByOrg.get(o.id) ?? 0 }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 6);

  return {
    mrr,
    arr: mrr * 12,
    orgs: orgs.length,
    users: users.length,
    agents: agents.length,
    activeAgents: agents.filter((a) => a.status === "active").length,
    calls: calls.length,
    voices: voiceCount,
    byPlan: (["starter", "pro", "agency"] as const).map((p) => ({
      plan: p,
      count: byPlanCount[p] ?? 0,
      mrr: (byPlanCount[p] ?? 0) * (PLAN_PRICE[p] ?? 0),
    })),
    months,
    statusBreakdown,
    topOrgs,
  };
}

export async function listAllVoicesAdmin() {
  const rows = await prisma.voice.findMany({
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true } } },
    take: 300,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    status: r.status,
    gender: r.gender,
    accent: r.accent,
    orgName: r.organization.name,
    settings: r.settings,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listAllOrganizations() {
  const [rows, agentCounts] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { agents: true, users: true } } },
    }),
    prisma.agent.findMany({
      select: { organizationId: true, _count: { select: { calls: true } } },
    }),
  ]);
  const callsByOrg = new Map<string, number>();
  for (const a of agentCounts) {
    callsByOrg.set(
      a.organizationId,
      (callsByOrg.get(a.organizationId) ?? 0) + a._count.calls,
    );
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    plan: r.plan,
    agents: r._count.agents,
    users: r._count.users,
    calls: callsByOrg.get(r.id) ?? 0,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listAllUsers() {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true } } },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    isAdmin: r.isAdmin,
    orgName: r.organization.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listAllAgents() {
  const rows = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true } } },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    status: r.status,
    orgName: r.organization.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listAllCalls(limit = 100) {
  const rows = await prisma.call.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      agent: { select: { name: true, organization: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    status: r.status,
    durationSec: r.durationSec,
    outcome: r.outcome,
    fromNumber: r.fromNumber,
    agentName: r.agent.name,
    orgName: r.agent.organization.name,
    createdAt: r.createdAt.toISOString(),
  }));
}
