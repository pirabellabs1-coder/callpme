/**
 * Agrégations analytiques au niveau organisation.
 * Tout est calculé sur une fenêtre glissante (par défaut 14 jours) pour
 * rester cohérent entre les KPI et les graphiques.
 */
import { prisma } from "./client";
import type { AgentRole, CallStatus } from "../shared/types";
import { ROLE_ORDER } from "../agents/roles";

export interface DailyPoint {
  date: string; // AAAA-MM-JJ
  label: string; // "12 juin"
  total: number;
  resolved: number;
}

export interface RoleBreakdown {
  role: AgentRole;
  calls: number;
  resolutionRate: number;
}

export interface AnalyticsSummary {
  windowDays: number;
  totalCalls: number;
  resolutionRate: number;
  avgDurationSec: number;
  transferRate: number;
  avgSatisfaction: number | null;
  activeAgents: number;
  totalAgents: number;
  directionSplit: { inbound: number; outbound: number };
  statusBreakdown: { status: CallStatus; count: number }[];
  series: DailyPoint[];
  roleBreakdown: RoleBreakdown[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const labelFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

export async function getAnalytics(
  orgId: string,
  days = 14,
): Promise<AnalyticsSummary> {
  // Ancre la fenêtre sur l'appel le plus récent (et non sur l'horloge), pour
  // que les graphiques restent peuplés même si les données datent un peu.
  const now = new Date();
  const latest = await prisma.call.findFirst({
    where: { agent: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const anchor = latest && latest.createdAt < now ? latest.createdAt : now;

  const since = new Date(anchor);
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const until = new Date(anchor);
  until.setHours(23, 59, 59, 999);

  const [calls, agents] = await Promise.all([
    prisma.call.findMany({
      where: {
        agent: { organizationId: orgId },
        createdAt: { gte: since, lte: until },
      },
      select: {
        status: true,
        direction: true,
        durationSec: true,
        satisfaction: true,
        createdAt: true,
        agent: { select: { role: true } },
      },
    }),
    prisma.agent.findMany({
      where: { organizationId: orgId },
      select: { status: true },
    }),
  ]);

  const total = calls.length;
  const resolved = calls.filter((c) => c.status === "completed").length;
  const transferred = calls.filter((c) => c.status === "transferred").length;
  const durations = calls.map((c) => c.durationSec).filter((d) => d > 0);
  const sats = calls
    .map((c) => c.satisfaction)
    .filter((s): s is number => typeof s === "number");

  // Séries journalières
  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(dayKey(d), {
      date: dayKey(d),
      label: labelFmt.format(d),
      total: 0,
      resolved: 0,
    });
  }
  for (const c of calls) {
    const key = dayKey(new Date(c.createdAt));
    const b = buckets.get(key);
    if (b) {
      b.total += 1;
      if (c.status === "completed") b.resolved += 1;
    }
  }

  // Répartition par statut
  const statuses: CallStatus[] = [
    "completed",
    "transferred",
    "missed",
    "failed",
    "in_progress",
  ];
  const statusBreakdown = statuses
    .map((status) => ({
      status,
      count: calls.filter((c) => c.status === status).length,
    }))
    .filter((s) => s.count > 0);

  // Répartition par rôle
  const roleBreakdown: RoleBreakdown[] = ROLE_ORDER.map((role) => {
    const roleCalls = calls.filter((c) => c.agent?.role === role);
    const roleResolved = roleCalls.filter(
      (c) => c.status === "completed",
    ).length;
    return {
      role,
      calls: roleCalls.length,
      resolutionRate:
        roleCalls.length > 0
          ? Math.round((roleResolved / roleCalls.length) * 100)
          : 0,
    };
  }).filter((r) => r.calls > 0);

  return {
    windowDays: days,
    totalCalls: total,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    avgDurationSec:
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
    transferRate: total > 0 ? Math.round((transferred / total) * 100) : 0,
    avgSatisfaction:
      sats.length > 0
        ? Math.round((sats.reduce((a, b) => a + b, 0) / sats.length) * 10) / 10
        : null,
    activeAgents: agents.filter((a) => a.status === "active").length,
    totalAgents: agents.length,
    directionSplit: {
      inbound: calls.filter((c) => c.direction === "inbound").length,
      outbound: calls.filter((c) => c.direction === "outbound").length,
    },
    statusBreakdown,
    series: Array.from(buckets.values()),
    roleBreakdown,
  };
}
