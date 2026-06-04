/**
 * Catalogue des offres Callpme. Source de vérité pour les prix, les limites
 * (appliquées réellement à la création d'agents / numéros) et l'affichage.
 */
export type PlanId = "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceLabel: string;
  priceMonthly: number | null;
  period: string;
  maxAgents: number;
  maxNumbers: number;
  minutes: number;
  features: string[];
  highlight?: boolean;
}

/** Seuil au-delà duquel une limite est considérée « illimitée ». */
export const UNLIMITED = 100000;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Pour démarrer avec un premier agent.",
    priceLabel: "49 €",
    priceMonthly: 49,
    period: "/ mois",
    maxAgents: 1,
    maxNumbers: 1,
    minutes: 500,
    features: [
      "1 agent vocal",
      "1 numéro inclus",
      "500 minutes / mois",
      "Statistiques de base",
      "Clés API",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Pour les équipes qui industrialisent.",
    priceLabel: "149 €",
    priceMonthly: 149,
    period: "/ mois",
    maxAgents: 10,
    maxNumbers: 5,
    minutes: 3000,
    features: [
      "10 agents vocaux",
      "5 numéros inclus",
      "3 000 minutes / mois",
      "Statistiques avancées",
      "Webhooks & API complète",
      "Tous les outils & garde-fous",
    ],
    highlight: true,
  },
  agency: {
    id: "agency",
    name: "Agence",
    tagline: "Pour gérer plusieurs clients.",
    priceLabel: "Sur devis",
    priceMonthly: null,
    period: "",
    maxAgents: UNLIMITED,
    maxNumbers: UNLIMITED,
    minutes: UNLIMITED,
    features: [
      "Agents illimités",
      "Multi-organisations",
      "Numéros à volume",
      "Support dédié",
      "Engagement SLA",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "pro", "agency"];
export const PLAN_IDS: readonly string[] = PLAN_ORDER;

export function isPlanId(x: string): x is PlanId {
  return x in PLANS;
}

export function getPlan(id: string | null | undefined): Plan {
  return id && isPlanId(id) ? PLANS[id] : PLANS.starter;
}

export function limitLabel(n: number): string {
  return n >= UNLIMITED ? "illimité" : String(n);
}
