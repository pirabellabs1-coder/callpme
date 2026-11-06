/**
 * État d'abonnement d'une organisation (module pur, testable).
 *
 * - Pas d'essai gratuit : à l'inscription, aucune minute tant qu'aucune offre
 *   n'est payée. Le client peut demander une démo, faite par l'équipe.
 * - Accès démo : accordé uniquement par l'équipe Callpme (trialEndsAt), quelques
 *   jours et TRIAL_MINUTES minutes, limites de l'offre Starter, pas d'achat de numéro.
 * - Abonnement payé : chaque paiement couvre PERIOD_DAYS jours (paidUntil),
 *   un renouvellement prolonge la période en cours.
 * - Expiré : plus de minutes d'appel (les agents et les données sont gardés).
 */
import { getPlan, type Plan } from "./plans";

/** Durée d'un accès démo accordé par l'équipe. */
export const DEMO_DAYS = 3;
export const TRIAL_MINUTES = 30;
export const PERIOD_DAYS = 30;
const DAY = 86_400_000;

export type SubscriptionStatus = "trial" | "active" | "expired";

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** Offre dont les limites s'appliquent (Starter pendant la démo). */
  plan: Plan;
  /** Minutes incluses sur la période en cours. */
  minutesIncluded: number;
  /** Début de la période de décompte des minutes. */
  periodStart: Date;
  /** Fin de l'accès démo ou de la période payée. */
  endsAt: Date;
  daysLeft: number;
  /** Aucune offre n'a jamais été payée (nouveau compte). */
  neverPaid: boolean;
}

export interface OrgBilling {
  plan: string;
  createdAt: Date;
  paidUntil: Date | null;
  trialEndsAt: Date | null;
}

export function subscriptionState(org: OrgBilling, now = new Date()): SubscriptionState {
  const daysLeft = (end: Date) => Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY));
  if (org.paidUntil && org.paidUntil > now) {
    const plan = getPlan(org.plan);
    const start = new Date(org.paidUntil.getTime() - PERIOD_DAYS * DAY);
    return { status: "active", plan, minutesIncluded: plan.minutes, periodStart: start, endsAt: org.paidUntil, daysLeft: daysLeft(org.paidUntil), neverPaid: false };
  }
  // Accès démo : seulement s'il a été accordé par l'équipe (aucun essai automatique).
  const trialEnd = org.trialEndsAt;
  if (trialEnd && trialEnd > now) {
    return {
      status: "trial",
      plan: getPlan("starter"),
      minutesIncluded: TRIAL_MINUTES,
      periodStart: new Date(Math.max(org.createdAt.getTime(), trialEnd.getTime() - DEMO_DAYS * DAY)),
      endsAt: trialEnd,
      daysLeft: daysLeft(trialEnd),
      neverPaid: !org.paidUntil,
    };
  }
  return {
    status: "expired",
    plan: getPlan(org.plan),
    minutesIncluded: 0,
    periodStart: now,
    endsAt: org.paidUntil ?? trialEnd ?? org.createdAt,
    daysLeft: 0,
    neverPaid: !org.paidUntil,
  };
}

/**
 * Nouvelle fin de période après un paiement : un renouvellement de la même
 * offre s'ajoute à la période en cours ; un changement d'offre repart
 * d'aujourd'hui (la nouvelle offre s'applique tout de suite).
 */
export function extendPaidUntil(current: { plan: string; paidUntil: Date | null }, paidPlan: string, now = new Date(), days = PERIOD_DAYS): Date {
  const sameAndRunning = current.paidUntil && current.paidUntil > now && current.plan === paidPlan;
  const base = sameAndRunning ? current.paidUntil!.getTime() : now.getTime();
  return new Date(base + days * DAY);
}

/** Prix après code promo (en euros, arrondi, jamais négatif). */
export function applyPromo(amountEur: number, promo: { discountType: string; discountValue: number }): number {
  if (promo.discountType === "percent") return Math.max(0, Math.round((amountEur * (100 - Math.min(100, promo.discountValue))) / 100));
  if (promo.discountType === "amount") return Math.max(0, amountEur - promo.discountValue);
  return amountEur;
}
