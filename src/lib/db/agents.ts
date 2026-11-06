/**
 * Dépôt « Agents » — accès typé aux agents, avec (dé)sérialisation de la
 * config JSON et statistiques d'appels agrégées (sans requête N+1).
 */
import { bookingConfig } from "../agenda/slots";
import { getCountry } from "../geo/countries";
import { orgCountry } from "../geo/org-country";
import { prisma } from "./client";
import { toE164 } from "../telephony/e164";
import { zonedDayStart, zonedParts } from "./calls";
import type {
  Agent,
  AgentConfig,
  AgentRole,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput,
} from "../shared/types";

/* ----------------------------- Sérialisation ----------------------------- */

function parseConfig(raw: string): AgentConfig {
  try {
    const parsed = JSON.parse(raw) as AgentConfig;
    // Compat ascendante : champs récents absents des anciennes configs.
    if (!parsed.firstSpeaker) parsed.firstSpeaker = "agent";
    return parsed;
  } catch {
    // Config corrompue : on renvoie une coquille sûre plutôt que de planter.
    return {
      voice: { provider: "elevenlabs", voiceId: "", language: "fr-FR", speed: 1 },
      model: { provider: "openai", modelId: "gpt-4o", temperature: 0.5 },
      systemPrompt: "",
      firstMessage: "",
      firstSpeaker: "agent",
      guardrails: [],
      tools: [],
    };
  }
}

interface AgentRow {
  id: string;
  organizationId: string;
  clientId: string | null;
  knowledgeBaseId: string | null;
  name: string;
  role: string;
  status: string;
  config: string;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentStats {
  total: number;
  today: number;
  avgDurationSec: number;
  resolutionRate: number;
}

function toAgent(row: AgentRow, stats?: AgentStats): Agent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    knowledgeBaseId: row.knowledgeBaseId,
    name: row.name,
    role: row.role as AgentRole,
    status: row.status as AgentStatus,
    config: parseConfig(row.config),
    phoneNumber: row.phoneNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    callsToday: stats?.today ?? 0,
    callsTotal: stats?.total ?? 0,
    avgDurationSec: stats?.avgDurationSec ?? 0,
    resolutionRate: stats?.resolutionRate ?? 0,
  };
}

/* ------------------------------ Statistiques ----------------------------- */

/** Minuit aujourd'hui à l'heure de Paris (changements d'heure compris). */
function startOfToday(): Date {
  return zonedDayStart(zonedParts(new Date()).ymd);
}

/** Agrège, pour chaque agent de l'org, total / aujourd'hui / durée moy. / taux de résolution. */
async function getAgentStats(orgId: string): Promise<Map<string, AgentStats>> {
  const agents = await prisma.agent.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const ids = agents.map((a) => a.id);
  const map = new Map<string, AgentStats>();
  if (ids.length === 0) return map;

  const [totals, completed, today] = await Promise.all([
    prisma.call.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids } },
      _count: { _all: true },
      _avg: { durationSec: true },
    }),
    prisma.call.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids }, status: "completed" },
      _count: { _all: true },
    }),
    prisma.call.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids }, createdAt: { gte: startOfToday() } },
      _count: { _all: true },
    }),
  ]);

  const completedMap = new Map(completed.map((c) => [c.agentId, c._count._all]));
  const todayMap = new Map(today.map((c) => [c.agentId, c._count._all]));

  for (const id of ids) {
    const t = totals.find((x) => x.agentId === id);
    const total = t?._count._all ?? 0;
    const done = completedMap.get(id) ?? 0;
    map.set(id, {
      total,
      today: todayMap.get(id) ?? 0,
      avgDurationSec: Math.round(t?._avg.durationSec ?? 0),
      resolutionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  }
  return map;
}

/* -------------------------------- Lecture -------------------------------- */

export interface ListAgentsOptions {
  role?: AgentRole;
  status?: AgentStatus;
  search?: string;
  clientId?: string | null;
}

export async function listAgents(
  orgId: string,
  opts: ListAgentsOptions = {},
): Promise<Agent[]> {
  const rows = await prisma.agent.findMany({
    where: {
      organizationId: orgId,
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.search
        ? { name: { contains: opts.search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const stats = await getAgentStats(orgId);
  return rows.map((r) => toAgent(r, stats.get(r.id)));
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const row = await prisma.agent.findUnique({ where: { id } });
  if (!row) return null;
  const stats = await getAgentStats(row.organizationId);
  return toAgent(row, stats.get(row.id));
}

export async function countAgents(orgId: string): Promise<number> {
  return prisma.agent.count({ where: { organizationId: orgId } });
}

/* ------------------------------- Écriture -------------------------------- */

/** Référence (client, base de connaissances) n'appartenant pas à l'organisation. */
export class ForeignReferenceError extends Error {
  constructor(field: "clientId" | "knowledgeBaseId" | "phoneNumber", message?: string) {
    super(message ?? `Référence invalide : ${field}`);
    this.name = "ForeignReferenceError";
  }
}

/**
 * Un agent ne peut recevoir qu'un numéro que son organisation possède
 * (table « Numéros ») — sinon un client pourrait détourner les appels
 * entrants d'un autre. Le numéro est stocké au format E.164, ce qui rend
 * aussi l'unicité effective (« +33 1 … » et « +331… » sont le même numéro).
 */
export async function ownedPhoneNumber(
  orgId: string,
  raw: string | null | undefined,
): Promise<string | null> {
  if (raw == null || raw.trim() === "") return null;
  const e164 = toE164(raw);
  if (!e164) {
    throw new ForeignReferenceError("phoneNumber", "Numéro invalide : format international attendu (ex. +33 1 84 80 11 02).");
  }
  const owned = await prisma.phoneNumber.findFirst({
    where: { organizationId: orgId, number: { in: [e164, raw.trim()] } },
    select: { id: true },
  });
  if (!owned) {
    throw new ForeignReferenceError(
      "phoneNumber",
      "Ce numéro n'appartient pas à votre organisation : ajoutez-le d'abord dans « Numéros ».",
    );
  }
  const taken = await prisma.agent.findFirst({
    where: { phoneNumber: e164, organizationId: { not: orgId } },
    select: { id: true },
  });
  if (taken) throw new ForeignReferenceError("phoneNumber", "Ce numéro est déjà utilisé.");
  return e164;
}

/**
 * Vérifie que le client et la base de connaissances rattachés appartiennent
 * bien à l'organisation — sinon un utilisateur pourrait brancher la base d'un
 * autre tenant sur son agent et en exfiltrer le contenu via le chat.
 */
async function assertOwnedRefs(
  orgId: string,
  refs: { clientId?: string | null; knowledgeBaseId?: string | null },
): Promise<void> {
  if (refs.clientId) {
    const ok = await prisma.client.findFirst({
      where: { id: refs.clientId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok) throw new ForeignReferenceError("clientId");
  }
  if (refs.knowledgeBaseId) {
    const ok = await prisma.knowledgeBase.findFirst({
      where: { id: refs.knowledgeBaseId, organizationId: orgId },
      select: { id: true },
    });
    if (!ok) throw new ForeignReferenceError("knowledgeBaseId");
  }
}

export async function createAgent(
  orgId: string,
  input: CreateAgentInput,
): Promise<Agent> {
  await assertOwnedRefs(orgId, input);
  const phoneNumber = await ownedPhoneNumber(orgId, input.phoneNumber);
  // Agenda : par défaut, le fuseau horaire du pays de l'organisation.
  if (!input.config.booking?.timezone) {
    const tz = getCountry(await orgCountry(orgId)).timezone;
    input = { ...input, config: { ...input.config, booking: { ...bookingConfig(input.config.booking), timezone: tz } } };
  }
  const row = await prisma.agent.create({
    data: {
      organizationId: orgId,
      name: input.name,
      role: input.role,
      status: input.status ?? "draft",
      config: JSON.stringify(input.config),
      phoneNumber,
      clientId: input.clientId ?? null,
      knowledgeBaseId: input.knowledgeBaseId ?? null,
    },
  });
  return toAgent(row);
}

export async function updateAgent(
  id: string,
  patch: UpdateAgentInput,
): Promise<Agent | null> {
  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) return null;
  await assertOwnedRefs(existing.organizationId, patch);
  const phoneNumber =
    patch.phoneNumber !== undefined
      ? await ownedPhoneNumber(existing.organizationId, patch.phoneNumber)
      : undefined;

  // Fusion superficielle de la config (les sous-objets fournis remplacent).
  const mergedConfig: AgentConfig | undefined = patch.config
    ? { ...parseConfig(existing.config), ...patch.config }
    : undefined;

  const row = await prisma.agent.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
      ...(patch.knowledgeBaseId !== undefined
        ? { knowledgeBaseId: patch.knowledgeBaseId }
        : {}),
      ...(mergedConfig ? { config: JSON.stringify(mergedConfig) } : {}),
    },
  });
  return toAgent(row);
}

export async function deleteAgent(id: string): Promise<void> {
  await prisma.agent.delete({ where: { id } });
}

export async function assignNumber(
  id: string,
  raw: string | null,
): Promise<Agent | null> {
  const existing = await prisma.agent.findUnique({ where: { id }, select: { organizationId: true } });
  if (!existing) return null;
  const phoneNumber = await ownedPhoneNumber(existing.organizationId, raw);
  const row = await prisma.agent.update({
    where: { id },
    data: { phoneNumber },
  });
  return toAgent(row);
}
