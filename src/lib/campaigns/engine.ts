/**
 * Moteur des campagnes sortantes.
 *
 * Un « tour » (tick) regarde chaque campagne en cours et, si l'on est dans
 * une plage horaire autorisée, compose autant de contacts que la limite
 * d'appels simultanés le permet : contacts jamais appelés d'abord, puis
 * relances arrivées à échéance. La liste d'opposition est toujours respectée.
 *
 * Le tour est lancé par le serveur vocal (toutes les 30 s), par la route
 * /api/cron/campaigns (cron de l'hébergeur), et immédiatement au lancement.
 */
import { orgCountry } from "../geo/org-country";
import { prisma } from "../db/client";
import { getAgentById } from "../db/agents";
import { canCallOut } from "../billing/limits";
import { checkDestination } from "../telephony/destinations";
import { placeOutboundCall, telephonyConfigured } from "../telephony/provider";
import { toE164 } from "../telephony/e164";
import { afterAttempt, campaignSettings, inCallingWindow, RETRYABLE } from "./settings";

/** Au-delà de la durée maximale d'un appel (2 h) + marge, un contact « en cours » est considéré perdu. */
const STALE_CALLING_MS = (7200 + 300) * 1000;
/** Durée du verrou de tour d'une campagne. */
const TICK_LEASE_MS = 60_000;
/** Budget de temps d'un tour global (cron serverless : 60 s maximum). */
const TICK_BUDGET_MS = 45_000;

/* ----------------------------- Liste d'opposition ----------------------------- */

export async function isOptedOut(organizationId: string, phone: string): Promise<boolean> {
  const e164 = toE164(phone, await orgCountry(organizationId));
  if (!e164) return false;
  return Boolean(await prisma.doNotCall.findUnique({ where: { organizationId_phone: { organizationId, phone: e164 } } }));
}

/** Ajout en masse (import Bloctel…) : requêtes groupées, numéros normalisés et dédoublonnés. */
export async function addOptOuts(organizationId: string, phones: string[], reason: string): Promise<{ added: number; invalid: number }> {
  const cc = await orgCountry(organizationId);
  const valid = Array.from(new Set(phones.map((p) => toE164(p, cc)).filter((p): p is string => Boolean(p))));
  const invalid = phones.length - phones.filter((p) => toE164(p, cc)).length;
  let added = 0;
  for (let i = 0; i < valid.length; i += 1000) {
    const chunk = valid.slice(i, i + 1000);
    const r = await prisma.doNotCall.createMany({
      data: chunk.map((phone) => ({ organizationId, phone, reason: reason.slice(0, 200) })),
      skipDuplicates: true,
    });
    added += r.count;
    await prisma.contact.updateMany({
      where: { campaign: { organizationId }, phone: { in: chunk }, status: { in: ["pending", ...Array.from(RETRYABLE)] } },
      data: { status: "opted_out", nextAttemptAt: null },
    });
  }
  return { added, invalid };
}

/** Ajoute un numéro à la liste d'opposition et retire ses appels en attente. */
export async function addOptOut(organizationId: string, phone: string, reason: string): Promise<boolean> {
  const e164 = toE164(phone, await orgCountry(organizationId));
  if (!e164) return false;
  await prisma.doNotCall.upsert({
    where: { organizationId_phone: { organizationId, phone: e164 } },
    create: { organizationId, phone: e164, reason: reason.slice(0, 200) },
    update: {},
  });
  await prisma.contact.updateMany({
    where: { campaign: { organizationId }, phone: { in: [e164, phone] }, status: { in: ["pending", ...Array.from(RETRYABLE)] } },
    data: { status: "opted_out", nextAttemptAt: null },
  });
  return true;
}

/* --------------------------------- Issues ---------------------------------- */

/**
 * Enregistre l'issue d'une tentative et planifie la relance si nécessaire.
 * Appelé par le moteur vocal (fin d'appel) et par le rappel de statut de
 * l'opérateur (pas de réponse, occupé, échec).
 */
export async function recordContactOutcome(
  where: { contactId?: string; providerCallId?: string; organizationId?: string },
  status: "completed" | "no_answer" | "failed" | "voicemail",
  outcome?: string,
): Promise<void> {
  const contact = await prisma.contact.findFirst({
    where: {
      ...(where.contactId ? { id: where.contactId } : { providerCallId: where.providerCallId ?? "__none__" }),
      ...(where.organizationId ? { campaign: { organizationId: where.organizationId } } : {}),
    },
    include: { campaign: { select: { settings: true } } },
  });
  // Seul un contact « en cours d'appel » reçoit une issue : un rappel tardif ou
  // en double de l'opérateur n'écrase pas un contact joint ou déjà relancé.
  if (!contact || contact.status !== "calling") return;
  const next = afterAttempt(status, Math.max(1, contact.attempts), campaignSettings(contact.campaign.settings));
  await prisma.contact.updateMany({
    where: { id: contact.id, status: "calling", attempts: contact.attempts },
    data: {
      status: next.status,
      nextAttemptAt: next.nextAttemptAt,
      ...(outcome ? { outcome } : {}),
      calledAt: contact.calledAt ?? new Date(),
    },
  });
}

/* ---------------------------------- Tours ---------------------------------- */

export interface TickReport {
  campaignId: string;
  placed: number;
  skipped?: "hors-plage" | "quota" | "agent" | "terminee" | "complet";
}

/** Un tour pour une campagne. */
export async function tickCampaign(campaignId: string, now = new Date()): Promise<TickReport> {
  const camp = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!camp || camp.status !== "running") return { campaignId, placed: 0, skipped: "terminee" };
  const s = campaignSettings(camp.settings);

  // Verrou de tour : un autre moteur (cron, autre instance) ne compose pas en même temps.
  const lease = await prisma.campaign.updateMany({
    where: { id: campaignId, status: "running", OR: [{ tickUntil: null }, { tickUntil: { lt: now } }] },
    data: { tickUntil: new Date(now.getTime() + TICK_LEASE_MS) },
  });
  if (lease.count === 0) return { campaignId, placed: 0, skipped: "complet" };
  try {
    return await tickLocked(campaignId, s, camp.organizationId, camp.agentId, now);
  } finally {
    await prisma.campaign.update({ where: { id: campaignId }, data: { tickUntil: null } }).catch(() => {});
  }
}

async function tickLocked(
  campaignId: string,
  s: ReturnType<typeof campaignSettings>,
  organizationId: string,
  agentId: string,
  now: Date,
): Promise<TickReport> {
  // Appels « en cours » restés sans nouvelles : échec, avec relance si possible.
  const stale = await prisma.contact.findMany({
    where: { campaignId, status: "calling", calledAt: { lt: new Date(now.getTime() - STALE_CALLING_MS) } },
    select: { id: true, attempts: true },
  });
  for (const c of stale) {
    const next = afterAttempt("failed", Math.max(1, c.attempts), s, now);
    await prisma.contact.updateMany({
      where: { id: c.id, status: "calling" },
      data: { status: "failed", outcome: "Sans nouvelles de l'opérateur", nextAttemptAt: next.nextAttemptAt },
    });
  }

  const eligible = {
    campaignId,
    OR: [{ status: "pending" }, { status: { in: Array.from(RETRYABLE) }, nextAttemptAt: { lte: now } }],
  };

  // Plus rien à faire : la campagne est terminée.
  const [remaining, calling] = await Promise.all([
    prisma.contact.count({
      where: { campaignId, OR: [{ status: "pending" }, { status: "calling" }, { nextAttemptAt: { not: null } }] },
    }),
    prisma.contact.count({ where: { campaignId, status: "calling" } }),
  ]);
  if (remaining === 0) {
    await prisma.campaign.updateMany({ where: { id: campaignId, status: "running" }, data: { status: "completed" } });
    return { campaignId, placed: 0, skipped: "terminee" };
  }
  if (!inCallingWindow(now, s)) return { campaignId, placed: 0, skipped: "hors-plage" };
  const slots = s.maxConcurrent - calling;
  if (slots <= 0) return { campaignId, placed: 0, skipped: "complet" };

  const agent = await getAgentById(agentId);
  if (!agent || agent.organizationId !== organizationId) return { campaignId, placed: 0, skipped: "agent" };
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true } });
  const quota = await canCallOut(organizationId);
  if (!quota.ok) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "paused" } });
    return { campaignId, placed: 0, skipped: "quota" };
  }

  const batch = await prisma.contact.findMany({
    where: eligible,
    orderBy: [{ attempts: "asc" }, { createdAt: "asc" }],
    take: slots,
  });

  let placed = 0;
  for (const c of batch) {
    // Réservation atomique : deux tours simultanés n'appellent pas le même contact.
    const claimed = await prisma.contact.updateMany({
      where: { id: c.id, status: c.status, attempts: c.attempts },
      data: { status: "calling", attempts: { increment: 1 }, nextAttemptAt: null, calledAt: now },
    });
    if (claimed.count === 0) continue;

    if (await isOptedOut(organizationId, c.phone)) {
      await prisma.contact.update({ where: { id: c.id }, data: { status: "opted_out", outcome: "Liste d'opposition" } });
      continue;
    }
    const dest = checkDestination(c.phone);
    if (!dest.ok) {
      await prisma.contact.update({ where: { id: c.id }, data: { status: "failed", outcome: dest.reason ?? "Destination non autorisée" } });
      continue;
    }
    const result = await placeOutboundCall({
      agent,
      toNumber: c.phone,
      metadata: { contactId: c.id, campaignId },
    });
    if (result.ok && result.callId) {
      await prisma.contact.update({ where: { id: c.id }, data: { providerCallId: result.callId } });
      placed += 1;
    } else {
      await recordContactOutcome({ contactId: c.id }, "failed", result.error ?? "Appel impossible");
    }
  }
  return { campaignId, placed };
}

/** Un tour pour toutes les campagnes en cours. */
export async function tickCampaigns(now = new Date()): Promise<TickReport[]> {
  if (!telephonyConfigured()) return [];
  const running = await prisma.campaign.findMany({ where: { status: "running" }, select: { id: true } });
  const reports: TickReport[] = [];
  const started = Date.now();
  for (const c of running) {
    if (Date.now() - started > TICK_BUDGET_MS) break; // le reste au prochain tour
    reports.push(
      await tickCampaign(c.id, now).catch((e) => {
        console.error(`[campagnes] ${c.id} :`, e instanceof Error ? e.message : e);
        return { campaignId: c.id, placed: 0 };
      }),
    );
  }
  return reports;
}
