/**
 * Application réelle des limites d'offre.
 */
import { getPlan } from "./plans";
import { subscriptionState, type SubscriptionState } from "./subscription";
import { extraMinutesConsumed } from "./topups";
import { countAgents } from "@/lib/db/agents";
import { prisma } from "@/lib/db/client";

export interface LimitCheck {
  ok: boolean;
  message?: string;
}

export async function canCreateAgent(
  orgId: string,
  plan: string,
): Promise<LimitCheck> {
  const p = getPlan(plan);
  const count = await countAgents(orgId);
  if (count >= p.maxAgents) {
    return {
      ok: false,
      message: `Limite de l'offre ${p.name} atteinte (${p.maxAgents} agent${
        p.maxAgents > 1 ? "s" : ""
      } maximum). Passez à une offre supérieure pour en créer davantage.`,
    };
  }
  return { ok: true };
}

/** État d'abonnement de l'organisation (essai, payé, expiré). */
export async function orgSubscription(orgId: string, now = new Date()): Promise<SubscriptionState> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, createdAt: true, paidUntil: true, trialEndsAt: true },
  });
  return subscriptionState(org ?? { plan: "starter", createdAt: now, paidUntil: null, trialEndsAt: null }, now);
}

/** Minutes d'appel consommées depuis une date. */
export async function minutesUsedSince(orgId: string, since: Date): Promise<number> {
  const agg = await prisma.call.aggregate({
    where: { agent: { organizationId: orgId }, createdAt: { gte: since } },
    _sum: { durationSec: true },
  });
  return Math.round((agg._sum.durationSec ?? 0) / 60);
}

/** Minutes consommées sur la période en cours (essai ou mois payé). */
export async function monthlyMinutesUsed(orgId: string): Promise<number> {
  const sub = await orgSubscription(orgId);
  return minutesUsedSince(orgId, sub.periodStart);
}

/** Message affiché quand l'abonnement ne couvre plus d'appels. */
function quotaMessage(sub: SubscriptionState): string {
  if (sub.status === "expired") return "Votre abonnement a expiré. Renouvelez-le dans Facturation pour reprendre les appels.";
  if (sub.status === "trial") return `Les ${sub.minutesIncluded} minutes de l'essai gratuit sont utilisées. Choisissez une offre dans Facturation pour continuer.`;
  return `Quota de l'offre ${sub.plan.name} atteint (${sub.minutesIncluded} minutes). Passez à une offre supérieure pour continuer.`;
}

/** Minutes rechargées encore disponibles (inutilisables si l'abonnement a expiré). */
export async function extraMinutesBalance(orgId: string, sub?: SubscriptionState): Promise<number> {
  const state = sub ?? (await orgSubscription(orgId));
  if (state.status === "expired") return 0;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { extraMinutes: true } });
  return Math.max(0, org?.extraMinutes ?? 0);
}

/**
 * Reste-t-il des minutes (offre + recharges) ? Le paramètre `_plan` est
 * conservé pour compatibilité : l'offre est relue en base.
 */
export async function canUseMinutes(orgId: string, _plan?: string): Promise<LimitCheck> {
  const sub = await orgSubscription(orgId);
  if (sub.status === "expired") return { ok: false, message: quotaMessage(sub) };
  const [used, extra] = await Promise.all([minutesUsedSince(orgId, sub.periodStart), extraMinutesBalance(orgId, sub)]);
  if (used >= sub.minutesIncluded + extra) {
    return {
      ok: false,
      message: `${quotaMessage(sub)} Vous pouvez aussi recharger des minutes en Mobile Money dans Facturation.`,
    };
  }
  return { ok: true };
}

/** Minutes restantes, recharges comprises (sert à plafonner la durée d'un appel). */
export async function remainingMinutes(orgId: string, _plan?: string): Promise<number> {
  const sub = await orgSubscription(orgId);
  if (sub.status === "expired") return 0;
  const [used, extra] = await Promise.all([minutesUsedSince(orgId, sub.periodStart), extraMinutesBalance(orgId, sub)]);
  return Math.max(0, sub.minutesIncluded + extra - used);
}

/**
 * Fin d'appel : retire des recharges la partie de l'appel qui dépasse les
 * minutes de l'offre (l'appel vient d'être enregistré).
 */
export async function consumeExtraMinutes(orgId: string, callDurationSec: number): Promise<void> {
  if (callDurationSec <= 0) return;
  const sub = await orgSubscription(orgId);
  const usedAfter = await minutesUsedSince(orgId, sub.periodStart);
  const callMinutes = Math.round(callDurationSec / 60);
  const consumed = extraMinutesConsumed(usedAfter - callMinutes, callMinutes, sub.minutesIncluded);
  if (consumed <= 0) return;
  // Jamais en dessous de zéro, même si deux appels se terminent en même temps.
  await prisma.$executeRaw`UPDATE "Organization" SET "extraMinutes" = GREATEST(0, "extraMinutes" - ${consumed}) WHERE id = ${orgId}`;
}
