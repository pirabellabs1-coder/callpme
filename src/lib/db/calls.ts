/**
 * Dépôt « Appels » — logs d'appels et transcripts, avec jointure agent.
 */
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
    summary: row.summary,
    outcome: row.outcome,
    satisfaction: row.satisfaction,
    createdAt: row.createdAt.toISOString(),
    agentName: row.agent?.name,
    agentRole: row.agent?.role as AgentRole | undefined,
  };
}

export interface ListCallsOptions {
  agentId?: string;
  status?: CallStatus;
  direction?: CallDirection;
  search?: string;
  limit?: number;
}

export async function listCalls(
  orgId: string,
  opts: ListCallsOptions = {},
): Promise<Call[]> {
  const rows = await prisma.call.findMany({
    where: {
      agent: { organizationId: orgId },
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.direction ? { direction: opts.direction } : {}),
      ...(opts.search
        ? {
            OR: [
              { fromNumber: { contains: opts.search } },
              { summary: { contains: opts.search } },
              { outcome: { contains: opts.search } },
            ],
          }
        : {}),
    },
    include: { agent: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map(toCall);
}

export async function getCallById(id: string): Promise<Call | null> {
  const row = await prisma.call.findUnique({
    where: { id },
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
      summary: data.summary ?? "Appel de test depuis le navigateur.",
      outcome: data.outcome ?? "Test",
    },
  });
  return row.id;
}
