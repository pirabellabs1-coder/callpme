/**
 * Progression « Bien démarrer » d'une organisation, calculée à partir des
 * données réelles (et non d'un état stocké) : elle reste juste si l'utilisateur
 * crée ou supprime des éléments ailleurs.
 */
import { prisma } from "./client";

export interface OnboardingStep {
  key: "agent" | "test" | "number" | "knowledge" | "integration";
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export async function getOnboardingSteps(orgId: string): Promise<OnboardingStep[]> {
  const [agents, calls, numbers, agentWithNumber, knowledge, integrations] = await Promise.all([
    prisma.agent.count({ where: { organizationId: orgId } }),
    prisma.call.count({ where: { agent: { organizationId: orgId } } }),
    prisma.phoneNumber.count({ where: { organizationId: orgId } }),
    prisma.agent.count({ where: { organizationId: orgId, phoneNumber: { not: null } } }),
    prisma.knowledgeBase.count({ where: { organizationId: orgId } }),
    prisma.integration.count({ where: { organizationId: orgId, status: "connected" } }),
  ]);

  return [
    {
      key: "agent",
      label: "Créer votre premier agent",
      description: "Choisissez un rôle et une voix.",
      href: "/agents/new",
      done: agents > 0,
    },
    {
      key: "test",
      label: "Tester l'agent",
      description: "Parlez-lui depuis le navigateur.",
      href: "/start",
      done: calls > 0,
    },
    {
      key: "number",
      label: "Attribuer un numéro",
      description: "Numéro local ou renvoi de votre ligne.",
      href: "/numbers",
      done: numbers > 0 && agentWithNumber > 0,
    },
    {
      key: "knowledge",
      label: "Ajouter vos informations",
      description: "FAQ, tarifs, horaires : l'agent s'en sert pour répondre.",
      href: "/knowledge",
      done: knowledge > 0,
    },
    {
      key: "integration",
      label: "Connecter un outil",
      description: "Agenda ou CRM, pour que l'agent agisse.",
      href: "/integrations",
      done: integrations > 0,
    },
  ];
}
