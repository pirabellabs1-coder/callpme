/**
 * File des rappels automatiques (bips et appels manqués).
 *
 * 1. `requestCallback` : un appel entrant n'a pas abouti → le numéro est mis
 *    en file (une seule demande en attente par numéro), après les garde-fous :
 *    numéro valide et couvert, liste d'opposition, plafonds par jour et par
 *    heure, crédit d'appels sortants.
 * 2. `tickCallbacks` : le serveur vocal (toutes les 10 s) compose les rappels
 *    arrivés à échéance. Le crédit est réservé avant de composer (placeOutboundCall).
 * 3. `recordCallbackOutcome` : fin d'appel ou rappel de statut de l'opérateur.
 */
import { prisma } from "../db/client";
import { getAgentById } from "../db/agents";
import { orgCountry } from "../geo/org-country";
import { canCallOut } from "../billing/limits";
import { outboundDestinationOpen } from "../billing/outbound-rates";
import { checkDestination } from "../telephony/destinations";
import { toE164 } from "../telephony/e164";
import { placeOutboundCall, voiceEngineReady } from "../telephony/provider";
import { isOptedOut } from "../campaigns/engine";
import type { Agent } from "../shared/types";
import {
  afterCallbackAttempt,
  callbackRefusal,
  callbackSettings,
  CALLBACK_CALLING_DEDUPE_MS,
  CALLBACK_ENGINE_STALE_MS,
  CALLBACK_EXPIRE_MS,
  CALLBACK_MAX_DURATION_SEC,
  CALLBACK_STALE_MS,
  type CallbackRefusal,
} from "./settings";

const DAY_MS = 24 * 3600_000;
const HOUR_MS = 3600_000;
/** Rappels composés au maximum par tour (le reste au tour suivant, 10 s plus tard). */
const TICK_BATCH = 10;
/** Battement de cœur de la file (PlatformSetting) : prouve que quelqu'un compose les rappels. */
const HEARTBEAT_KEY = "callbacks.lastTick";

async function engineAlive(now: Date): Promise<boolean> {
  const row = await prisma.platformSetting.findUnique({ where: { key: HEARTBEAT_KEY }, select: { value: true } });
  const at = row ? Number(row.value) : 0;
  return Number.isFinite(at) && now.getTime() - at < CALLBACK_ENGINE_STALE_MS;
}

export type CallbackRequest = { ok: true; id: string; dueAt: Date } | { ok: false; reason: CallbackRefusal };

/** Met un numéro en file de rappel (idempotent : une seule demande en attente par numéro). */
export async function requestCallback(opts: {
  agent: Agent;
  from: string;
  reason: "flash" | "missed";
  now?: Date;
}): Promise<CallbackRequest> {
  const now = opts.now ?? new Date();
  const cfg = callbackSettings(opts.agent.config.callback);
  const organizationId = opts.agent.organizationId;
  if (!cfg.enabled) return { ok: false, reason: "disabled" };
  const phone = opts.from && opts.from !== "inconnu" ? toE164(opts.from, await orgCountry(organizationId)) : null;
  const destinationOpen = Boolean(phone && outboundDestinationOpen(phone) && checkDestination(phone).ok);

  // Refus sans base de données d'abord (mode, numéro masqué, destination).
  const early = callbackRefusal({ cfg, reason: opts.reason, phone, destinationOpen, sentToday: 0, sentThisHour: 0 });
  if (early) return { ok: false, reason: early };
  const to = phone!;

  // Jamais un numéro de la plateforme (boucle de rappels entre deux agents).
  if (await prisma.phoneNumber.findUnique({ where: { number: to }, select: { id: true } })) {
    return { ok: false, reason: "own_number" };
  }
  if (await isOptedOut(organizationId, to)) return { ok: false, reason: "opted_out" };
  if (!(await canCallOut(organizationId)).ok) return { ok: false, reason: "credit" };
  // Mode « bip » : on ne refuse l'appel que si un moteur compose bien les rappels.
  if (opts.reason === "flash" && !(await engineAlive(now))) return { ok: false, reason: "engine" };

  // Verrou par organisation : la fin de session et le rappel de statut de l'opérateur
  // peuvent signaler le même appel au même instant, et les plafonds restent exacts.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`callback:${organizationId}`}, 0))) AS l`;
    // En attente, ou composé il y a moins de 3 min (un rappel resté « en cours » ne bloque pas le numéro).
    const waiting = await tx.callback.findFirst({
      where: {
        organizationId,
        phone: to,
        OR: [
          { status: "pending" },
          { status: "calling", dueAt: { gte: new Date(now.getTime() - CALLBACK_CALLING_DEDUPE_MS) } },
        ],
      },
      select: { id: true, dueAt: true },
    });
    if (waiting) return { ok: true as const, id: waiting.id, dueAt: waiting.dueAt };
    const since = new Date(now.getTime() - DAY_MS);
    const [sentToday, sentThisHour, sentOrgToday] = await Promise.all([
      tx.callback.count({ where: { organizationId, phone: to, createdAt: { gte: since } } }),
      tx.callback.count({ where: { organizationId, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } } }),
      tx.callback.count({ where: { organizationId, createdAt: { gte: since } } }),
    ]);
    const refusal = callbackRefusal({ cfg, reason: opts.reason, phone: to, destinationOpen, sentToday, sentThisHour, sentOrgToday });
    if (refusal) return { ok: false as const, reason: refusal };
    const dueAt = new Date(now.getTime() + cfg.delaySec * 1000);
    const created = await tx.callback.create({
      data: { organizationId, agentId: opts.agent.id, phone: to, reason: opts.reason, dueAt },
      select: { id: true },
    });
    return { ok: true as const, id: created.id, dueAt };
  });
}

/**
 * Issue d'un rappel. Seul un rappel « en cours » reçoit une issue : un rappel
 * de statut tardif ou en double n'écrase pas une conversation aboutie.
 */
export async function recordCallbackOutcome(
  where: { callbackId?: string; providerCallId?: string; organizationId?: string },
  status: "completed" | "no_answer" | "failed",
  extra: { outcome?: string; callId?: string; retry?: boolean } = {},
  now = new Date(),
): Promise<void> {
  if (!where.callbackId && !where.providerCallId) return;
  const cb = await prisma.callback.findFirst({
    where: {
      ...(where.callbackId ? { id: where.callbackId } : { providerCallId: where.providerCallId }),
      ...(where.organizationId ? { organizationId: where.organizationId } : {}),
    },
    select: { id: true, status: true, attempts: true },
  });
  if (!cb) return;
  if (cb.status !== "calling") {
    // Issue déjà connue (rappel de statut arrivé avant la fin de session) : on rattache l'appel enregistré.
    if (extra.callId) await prisma.callback.updateMany({ where: { id: cb.id, callId: null }, data: { callId: extra.callId } });
    return;
  }
  const next = afterCallbackAttempt(status, cb.attempts, now, { retry: extra.retry });
  await prisma.callback.updateMany({
    where: { id: cb.id, status: "calling", attempts: cb.attempts },
    data: {
      status: next.status,
      ...(next.dueAt ? { dueAt: next.dueAt, providerCallId: null } : {}),
      ...(extra.outcome ? { outcome: extra.outcome.slice(0, 200) } : {}),
      ...(extra.callId ? { callId: extra.callId } : {}),
    },
  });
}

export interface CallbackTickReport {
  placed: number;
  expired: number;
  failed: number;
}

/** Un tour : clôt les rappels périmés et compose ceux arrivés à échéance. */
export async function tickCallbacks(now = new Date()): Promise<CallbackTickReport> {
  const report: CallbackTickReport = { placed: 0, expired: 0, failed: 0 };
  if (!voiceEngineReady()) return report;
  await prisma.platformSetting
    .upsert({ where: { key: HEARTBEAT_KEY }, create: { key: HEARTBEAT_KEY, value: String(now.getTime()) }, update: { value: String(now.getTime()) } })
    .catch(() => {});

  const expired = await prisma.callback.updateMany({
    where: { status: "pending", dueAt: { lt: new Date(now.getTime() - CALLBACK_EXPIRE_MS) } },
    data: { status: "expired", outcome: "Rappel non passé à temps" },
  });
  report.expired = expired.count;
  await prisma.callback.updateMany({
    where: { status: "calling", dueAt: { lt: new Date(now.getTime() - CALLBACK_STALE_MS) } },
    data: { status: "failed", outcome: "Sans nouvelles de l'opérateur" },
  });

  const due = await prisma.callback.findMany({
    where: { status: "pending", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: TICK_BATCH,
  });
  for (const cb of due) {
    // Réservation atomique : deux tours simultanés ne composent pas le même rappel.
    const claimed = await prisma.callback.updateMany({
      where: { id: cb.id, status: "pending", attempts: cb.attempts },
      // dueAt = instant de composition (sert au dédoublonnage et à la péremption).
      data: { status: "calling", attempts: { increment: 1 }, dueAt: now },
    });
    if (claimed.count === 0) continue;
    const fail = async (outcome: string) => {
      report.failed += 1;
      await prisma.callback.update({ where: { id: cb.id }, data: { status: "failed", outcome } });
    };

    const agent = await getAgentById(cb.agentId).catch(() => null);
    if (!agent || agent.organizationId !== cb.organizationId || agent.status !== "active") {
      await fail("Agent hors ligne");
      continue;
    }
    if (!callbackSettings(agent.config.callback).enabled) {
      await fail("Rappel désactivé");
      continue;
    }
    // La personne a pu s'inscrire sur la liste d'opposition entre-temps.
    if (await isOptedOut(cb.organizationId, cb.phone)) {
      await fail("Liste d'opposition");
      continue;
    }
    const result = await placeOutboundCall({
      agent,
      toNumber: cb.phone,
      metadata: { callbackId: cb.id },
      maxDurationSec: CALLBACK_MAX_DURATION_SEC,
    });
    if (result.ok) {
      if (result.callId) await prisma.callback.update({ where: { id: cb.id }, data: { providerCallId: result.callId } });
      report.placed += 1;
    } else {
      await fail(result.code === "insufficient_credit" ? "Crédit d'appels insuffisant" : (result.error ?? "Appel impossible").slice(0, 200));
    }
  }
  return report;
}
