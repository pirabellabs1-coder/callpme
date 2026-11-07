/** Dépôt « Rendez-vous » et « Prospects » (lecture pour le tableau de bord et l'API). */
import { prisma } from "./client";
import { bookingConfig } from "../agenda/slots";

function agentTimezone(config: string | null | undefined): string {
  try {
    return bookingConfig(JSON.parse(config ?? "{}").booking).timezone;
  } catch {
    return bookingConfig().timezone;
  }
}

export interface AppointmentRow {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  startsAt: string;
  durationMin: number;
  status: string;
  isTest: boolean;
  source: string;
  agentId: string | null;
  agentName: string | null;
  synced: boolean;
  /** Fuseau de l'agenda de l'agent (affichage à l'heure locale du rendez-vous). */
  timezone: string;
}

export async function listAppointments(
  orgId: string,
  opts: { view?: "upcoming" | "past"; includeTest?: boolean; limit?: number } = {},
): Promise<AppointmentRow[]> {
  const now = new Date();
  const past = opts.view === "past";
  const rows = await prisma.appointment.findMany({
    where: {
      organizationId: orgId,
      ...(opts.includeTest ? {} : { isTest: false }),
      ...(past ? { startsAt: { lt: now } } : { startsAt: { gte: new Date(now.getTime() - 3600_000) } }),
    },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: Math.min(opts.limit ?? 200, 500),
    include: { agent: { select: { name: true, config: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    notes: r.notes,
    startsAt: r.startsAt.toISOString(),
    durationMin: r.durationMin,
    status: r.status,
    isTest: r.isTest,
    source: r.source,
    agentId: r.agentId,
    agentName: r.agent?.name ?? null,
    synced: Boolean(r.googleEventId),
    timezone: agentTimezone(r.agent?.config),
  }));
}

export interface LeadRow {
  id: string;
  kind: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  score: number | null;
  interest: string | null;
  status: string;
  callbackAt: string | null;
  isTest: boolean;
  agentName: string | null;
  createdAt: string;
  crm: string[];
  timezone: string;
}

export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export async function listLeads(
  orgId: string,
  opts: { kind?: string; status?: string; includeTest?: boolean; limit?: number } = {},
): Promise<LeadRow[]> {
  const rows = await prisma.lead.findMany({
    where: {
      organizationId: orgId,
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.includeTest ? {} : { isTest: false }),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? 300, 1000),
    include: { agent: { select: { name: true, config: true } } },
  });
  return rows.map((r) => {
    let crm: string[] = [];
    try {
      crm = Object.keys(JSON.parse(r.externalIds ?? "{}"));
    } catch {
      /* ignoré */
    }
    return {
      id: r.id,
      kind: r.kind,
      name: r.name,
      phone: r.phone,
      email: r.email,
      notes: r.notes,
      score: r.score,
      interest: r.interest,
      status: r.status,
      callbackAt: r.callbackAt?.toISOString() ?? null,
      isTest: r.isTest,
      agentName: r.agent?.name ?? null,
      createdAt: r.createdAt.toISOString(),
      crm,
      timezone: agentTimezone(r.agent?.config),
    };
  });
}

export async function leadCounts(orgId: string): Promise<Record<string, number>> {
  const rows = await prisma.lead.groupBy({
    by: ["kind"],
    where: { organizationId: orgId, isTest: false, status: { in: ["new", "contacted"] } },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.kind, r._count]));
}

/** Rendez-vous et indisponibilités d'une période (vue calendrier). */
export async function listAppointmentsBetween(orgId: string, from: Date, to: Date): Promise<AppointmentRow[]> {
  const rows = await prisma.appointment.findMany({
    where: { organizationId: orgId, isTest: false, status: "booked", startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: "asc" },
    take: 1000,
    include: { agent: { select: { name: true, config: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    notes: r.notes,
    startsAt: r.startsAt.toISOString(),
    durationMin: r.durationMin,
    status: r.status,
    isTest: r.isTest,
    source: r.source,
    agentId: r.agentId,
    agentName: r.agent?.name ?? null,
    synced: Boolean(r.googleEventId),
    timezone: agentTimezone(r.agent?.config),
  }));
}
