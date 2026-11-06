/**
 * Agrégations analytiques au niveau organisation.
 * Tout est calculé sur une fenêtre glissante (par défaut 14 jours) pour
 * rester cohérent entre les KPI et les graphiques. Les jours et les heures
 * sont exprimés dans le fuseau de l'application (Europe/Paris).
 */
import { prisma } from "./client";
import type { AgentRole, CallStatus } from "../shared/types";
import { ROLE_ORDER } from "../agents/roles";
import { addDaysYmd, zonedDayStart, zonedParts } from "./calls";

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

export interface AgentBreakdown {
  agentId: string;
  name: string;
  role: AgentRole;
  calls: number;
  resolutionRate: number;
  transferRate: number;
  avgDurationSec: number;
  avgSatisfaction: number | null;
}

export interface OutcomeCount {
  outcome: string;
  count: number;
}

export interface AnalyticsSummary {
  windowDays: number;
  /** Premier jour de la fenêtre (AAAA-MM-JJ, inclus). */
  fromDate: string;
  /** Dernier jour de la fenêtre (AAAA-MM-JJ, inclus). */
  toDate: string;
  /** Vrai si la fenêtre est ancrée sur le dernier appel et non sur aujourd'hui. */
  anchoredOnLastCall: boolean;
  totalCalls: number;
  resolutionRate: number;
  avgDurationSec: number;
  transferRate: number;
  avgSatisfaction: number | null;
  ratedCalls: number;
  activeAgents: number;
  totalAgents: number;
  directionSplit: { inbound: number; outbound: number };
  statusBreakdown: { status: CallStatus; count: number }[];
  series: DailyPoint[];
  roleBreakdown: RoleBreakdown[];
  agentBreakdown: AgentBreakdown[];
  outcomeBreakdown: OutcomeCount[];
  /** heatmap[jour 0=lundi][heure 0..23] = nombre d'appels. */
  heatmap: number[][];
}

const labelFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Libellé court ("12 juin") d'une date calendaire AAAA-MM-JJ. */
export function formatYmd(ymd: string, opts?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return opts
    ? new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(date)
    : labelFmt.format(date);
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export async function getAnalytics(
  orgId: string,
  days = 14,
): Promise<AnalyticsSummary> {
  // Ancre la fenêtre sur l'appel le plus récent (et non sur l'horloge), pour
  // que les graphiques restent peuplés même si les données datent un peu.
  // La page affiche alors explicitement la plage réelle.
  const now = new Date();
  const latest = await prisma.call.findFirst({
    where: { agent: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const anchor = latest && latest.createdAt < now ? latest.createdAt : now;

  const toDate = zonedParts(anchor).ymd;
  const fromDate = addDaysYmd(toDate, -(days - 1));
  const since = zonedDayStart(fromDate);
  const until = zonedDayStart(addDaysYmd(toDate, 1));

  const [calls, agents] = await Promise.all([
    prisma.call.findMany({
      where: {
        agent: { organizationId: orgId },
        createdAt: { gte: since, lt: until },
      },
      select: {
        status: true,
        direction: true,
        durationSec: true,
        satisfaction: true,
        outcome: true,
        createdAt: true,
        agentId: true,
        agent: { select: { role: true, name: true } },
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

  // Séries journalières + heatmap jour × heure (fuseau de l'application)
  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const key = addDaysYmd(fromDate, i);
    buckets.set(key, { date: key, label: formatYmd(key), total: 0, resolved: 0 });
  }
  const heatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const c of calls) {
    const p = zonedParts(c.createdAt);
    const b = buckets.get(p.ymd);
    if (b) {
      b.total += 1;
      if (c.status === "completed") b.resolved += 1;
    }
    if (p.weekday >= 0) heatmap[p.weekday][p.hour] += 1;
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
    const roleResolved = roleCalls.filter((c) => c.status === "completed").length;
    return {
      role,
      calls: roleCalls.length,
      resolutionRate: pct(roleResolved, roleCalls.length),
    };
  }).filter((r) => r.calls > 0);

  // Répartition par agent
  const byAgent = new Map<string, typeof calls>();
  for (const c of calls) {
    const list = byAgent.get(c.agentId);
    if (list) list.push(c);
    else byAgent.set(c.agentId, [c]);
  }
  const agentBreakdown: AgentBreakdown[] = Array.from(byAgent.entries())
    .map(([agentId, list]) => {
      const agentSats = list
        .map((c) => c.satisfaction)
        .filter((s): s is number => typeof s === "number");
      return {
        agentId,
        name: list[0].agent?.name ?? "Agent",
        role: (list[0].agent?.role ?? "support") as AgentRole,
        calls: list.length,
        resolutionRate: pct(list.filter((c) => c.status === "completed").length, list.length),
        transferRate: pct(list.filter((c) => c.status === "transferred").length, list.length),
        avgDurationSec: Math.round(avg(list.map((c) => c.durationSec).filter((d) => d > 0))),
        avgSatisfaction:
          agentSats.length > 0 ? Math.round(avg(agentSats) * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.calls - a.calls);

  // Issues métier les plus fréquentes
  const outcomes = new Map<string, number>();
  for (const c of calls) {
    const o = c.outcome?.trim();
    if (o) outcomes.set(o, (outcomes.get(o) ?? 0) + 1);
  }
  const outcomeBreakdown = Array.from(outcomes.entries())
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    windowDays: days,
    fromDate,
    toDate,
    anchoredOnLastCall: toDate !== zonedParts(now).ymd,
    totalCalls: total,
    resolutionRate: pct(resolved, total),
    avgDurationSec: Math.round(avg(durations)),
    transferRate: pct(transferred, total),
    avgSatisfaction: sats.length > 0 ? Math.round(avg(sats) * 10) / 10 : null,
    ratedCalls: sats.length,
    activeAgents: agents.filter((a) => a.status === "active").length,
    totalAgents: agents.length,
    directionSplit: {
      inbound: calls.filter((c) => c.direction === "inbound").length,
      outbound: calls.filter((c) => c.direction === "outbound").length,
    },
    statusBreakdown,
    series: Array.from(buckets.values()),
    roleBreakdown,
    agentBreakdown,
    outcomeBreakdown,
    heatmap,
  };
}
