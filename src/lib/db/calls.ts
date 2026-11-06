/**
 * Dépôt « Appels » — logs d'appels et transcripts, avec jointure agent.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import type {
  AgentRole,
  Call,
  CallDirection,
  CallStatus,
  TranscriptTurn,
} from "../shared/types";

function parseTranscript(raw: string): TranscriptTurn[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TranscriptTurn[]) : [];
  } catch {
    return [];
  }
}

interface CallRow {
  id: string;
  agentId: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  durationSec: number;
  transcript: string;
  audioUrl?: string | null;
  summary: string | null;
  outcome: string | null;
  satisfaction: number | null;
  createdAt: Date;
  agent?: { name: string; role: string } | null;
}

function toCall(row: CallRow): Call {
  return {
    id: row.id,
    agentId: row.agentId,
    direction: row.direction as CallDirection,
    fromNumber: row.fromNumber,
    toNumber: row.toNumber,
    status: row.status as CallStatus,
    durationSec: row.durationSec,
    transcript: parseTranscript(row.transcript),
    audioUrl: row.audioUrl ?? null,
    summary: row.summary,
    outcome: row.outcome,
    satisfaction: row.satisfaction,
    createdAt: row.createdAt.toISOString(),
    agentName: row.agent?.name,
    agentRole: row.agent?.role as AgentRole | undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Fuseau horaire                                                      */
/* ------------------------------------------------------------------ */

/** Fuseau de référence de l'application (produit français). */
export const APP_TIME_ZONE = "Europe/Paris";

const zonedFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Décompose une date dans le fuseau de l'application. weekday : 0 = lundi. */
export function zonedParts(d: Date): {
  ymd: string;
  hour: number;
  weekday: number;
} {
  const p: Record<string, string> = {};
  for (const part of zonedFmt.formatToParts(d)) p[part.type] = part.value;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour) % 24,
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

function offsetMs(d: Date): number {
  const p: Record<string, string> = {};
  for (const part of zonedFmt.formatToParts(d)) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

export function isYmd(value: string | undefined | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

/** Ajoute `n` jours à une date calendaire AAAA-MM-JJ. */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Instant de minuit (fuseau de l'application) pour une date AAAA-MM-JJ. */
export function zonedDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(new Date(guess));
  // Second passage : corrige le cas d'un changement d'heure dans l'intervalle.
  return new Date(guess - offsetMs(new Date(first)));
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

export interface ListCallsOptions {
  agentId?: string;
  status?: CallStatus;
  direction?: CallDirection;
  search?: string;
  /** Jour de début inclus (AAAA-MM-JJ, fuseau de l'application). */
  from?: string;
  /** Jour de fin inclus (AAAA-MM-JJ, fuseau de l'application). */
  to?: string;
  limit?: number;
  offset?: number;
}

/** Filtre commun — toujours cloisonné à l'organisation. */
function callsWhere(orgId: string, opts: ListCallsOptions): Prisma.CallWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (isYmd(opts.from)) createdAt.gte = zonedDayStart(opts.from);
  if (isYmd(opts.to)) createdAt.lt = zonedDayStart(addDaysYmd(opts.to, 1));
  const search = opts.search?.trim();

  return {
    agent: { organizationId: orgId },
    ...(opts.agentId ? { agentId: opts.agentId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.direction ? { direction: opts.direction } : {}),
    ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { fromNumber: { contains: search, mode: "insensitive" } },
            { toNumber: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
            { outcome: { contains: search, mode: "insensitive" } },
            { agent: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listCalls(
  orgId: string,
  opts: ListCallsOptions = {},
): Promise<Call[]> {
  const rows = await prisma.call.findMany({
    where: callsWhere(orgId, opts),
    // L'enregistrement audio (lourd) n'est jamais chargé dans les listes.
    omit: { audioUrl: true },
    include: { agent: { select: { name: true, role: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.limit ?? 100,
    ...(opts.offset ? { skip: opts.offset } : {}),
  });
  return rows.map(toCall);
}

/** Nombre d'appels correspondant aux filtres (pour la pagination). */
export async function countFilteredCalls(
  orgId: string,
  opts: ListCallsOptions = {},
): Promise<number> {
  return prisma.call.count({ where: callsWhere(orgId, opts) });
}

export interface CallExportRow {
  id: string;
  createdAt: Date;
  agentName: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  durationSec: number;
  outcome: string | null;
  satisfaction: number | null;
  summary: string | null;
}

/** Lignes légères (sans transcript ni audio) pour l'export CSV. */
export async function listCallsForExport(
  orgId: string,
  opts: ListCallsOptions = {},
  max = 10_000,
): Promise<CallExportRow[]> {
  const rows = await prisma.call.findMany({
    where: callsWhere(orgId, opts),
    select: {
      id: true,
      createdAt: true,
      direction: true,
      fromNumber: true,
      toNumber: true,
      status: true,
      durationSec: true,
      outcome: true,
      satisfaction: true,
      summary: true,
      agent: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: max,
  });
  return rows.map(({ agent, ...r }) => ({ ...r, agentName: agent?.name ?? "" }));
}

/**
 * Lit un appel. Avec `orgId`, ne renvoie l'appel que s'il appartient à
 * l'organisation (cloisonnement multi-tenant) — à toujours passer côté API.
 */
export async function getCallById(id: string, orgId?: string): Promise<Call | null> {
  const row = await prisma.call.findFirst({
    where: orgId ? { id, agent: { organizationId: orgId } } : { id },
    include: { agent: { select: { name: true, role: true } } },
  });
  return row ? toCall(row) : null;
}

export async function countCalls(orgId: string): Promise<number> {
  return prisma.call.count({ where: { agent: { organizationId: orgId } } });
}

/** Supprime un appel (et son évaluation), si l'organisation en est propriétaire. */
export async function deleteCall(orgId: string, id: string): Promise<boolean> {
  const row = await prisma.call.findUnique({
    where: { id },
    include: { agent: { select: { organizationId: true } } },
  });
  if (!row || row.agent?.organizationId !== orgId) return false;
  await prisma.evaluation.deleteMany({ where: { callId: id } }).catch(() => {});
  await prisma.call.delete({ where: { id } });
  return true;
}

/** Journalise un appel de test (navigateur) dans l'historique. */
export async function createTestCall(
  agentId: string,
  data: {
    transcript: TranscriptTurn[];
    durationSec: number;
    summary?: string;
    outcome?: string;
    audioUrl?: string | null;
  },
): Promise<string> {
  const row = await prisma.call.create({
    data: {
      agentId,
      direction: "inbound",
      fromNumber: "Test navigateur",
      toNumber: "Agent",
      status: "completed",
      durationSec: data.durationSec,
      transcript: JSON.stringify(data.transcript),
      audioUrl: data.audioUrl ?? null,
      summary: data.summary ?? "Appel de test depuis le navigateur.",
      outcome: data.outcome ?? "Test",
    },
  });
  return row.id;
}
