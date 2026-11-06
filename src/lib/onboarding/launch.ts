/**
 * Mise en ligne d'un agent : étapes calculées à partir des données réelles.
 * Chaque étape dit ce qui manque, pourquoi, et où le faire.
 */
import { prisma } from "@/lib/db/client";
import { orgSubscription } from "@/lib/billing/limits";
import type { Agent } from "@/lib/shared/types";

export type LaunchStepKey = "basics" | "knowledge" | "test" | "channel" | "online" | "plan";

export interface LaunchStep {
  key: LaunchStepKey;
  title: string;
  /** Pourquoi c'est utile, en une phrase. */
  why: string;
  done: boolean;
  /** Indispensable pour recevoir des appels (sinon : recommandé). */
  required: boolean;
  /** Ce qu'il reste à faire, quand l'étape n'est pas faite. */
  todo?: string;
  action?: { label: string; href: string };
}

export interface LaunchState {
  steps: LaunchStep[];
  /** L'agent répond vraiment à des personnes (en ligne + au moins un canal). */
  live: boolean;
  phone: { number: string; active: boolean } | null;
  widgetSites: string[];
  progress: number;
}

export async function getLaunchState(agent: Agent): Promise<LaunchState> {
  const base = `/agents/${agent.id}`;
  const [calls, phoneRow, sub] = await Promise.all([
    prisma.call.count({ where: { agentId: agent.id } }),
    agent.phoneNumber
      ? prisma.phoneNumber.findFirst({
          where: { number: agent.phoneNumber, organizationId: agent.organizationId },
          select: { number: true, status: true },
        })
      : Promise.resolve(null),
    orgSubscription(agent.organizationId),
  ]);
  const phone = phoneRow ? { number: phoneRow.number, active: phoneRow.status === "active" } : null;
  const widget = agent.config.widget;
  const widgetSites = widget?.enabled ? widget.allowedDomains : [];
  const hasChannel = Boolean(phone?.active) || widgetSites.length > 0;

  const steps: LaunchStep[] = [
    {
      key: "basics",
      title: "Présenter votre activité à l'agent",
      why: "Le message d'accueil et les consignes décident de tout ce que l'agent dit.",
      done: agent.config.systemPrompt.trim().length >= 80 && agent.config.firstMessage.trim().length > 0,
      required: true,
      todo: "Rédigez le message d'accueil et les consignes (rôle, ton, ce qu'il doit faire).",
      action: { label: "Configurer", href: `${base}/edit` },
    },
    {
      key: "knowledge",
      title: "Lui donner vos informations",
      why: "Horaires, tarifs, adresse, FAQ : sans elles, l'agent ne peut pas répondre aux questions précises.",
      done: Boolean(agent.knowledgeBaseId),
      required: false,
      todo: "Créez une base de connaissances (texte, PDF ou votre site web) et reliez-la à l'agent.",
      action: { label: "Ajouter des informations", href: "/knowledge" },
    },
    {
      key: "test",
      title: "Le tester vous-même",
      why: "Écoutez-le comme un client avant de lui confier de vrais appels.",
      done: calls > 0,
      required: false,
      todo: "Parlez-lui au micro ou par écrit, puis corrigez ce qui ne va pas.",
      action: { label: "Tester", href: `${base}/test` },
    },
    {
      key: "channel",
      title: "Choisir comment vos clients le joignent",
      why: "Un numéro de téléphone, un bouton sur votre site, ou les deux.",
      done: hasChannel,
      required: true,
      todo: phone && !phone.active
        ? `Le numéro ${phone.number} est en attente de vérification par l'équipe Callpme. En attendant, vous pouvez activer le bouton sur votre site.`
        : "Reliez un numéro (achat, numéro existant ou renvoi d'appel) ou activez le bouton sur votre site web.",
      action: phone ? { label: "Bouton site web", href: `${base}/widget` } : { label: "Choisir", href: `${base}/launch#canaux` },
    },
    {
      key: "online",
      title: "Le mettre en ligne",
      why: "Un agent en brouillon ou en pause ne répond à personne.",
      done: agent.status === "active",
      required: true,
      todo: "Passez l'agent « En ligne » quand vous êtes prêt.",
    },
    {
      key: "plan",
      title: "Avoir une offre active",
      why: "Les minutes d'appel sont comprises dans votre offre (ou votre accès démo).",
      done: sub.status !== "expired",
      required: true,
      todo: sub.neverPaid
        ? "Choisissez une offre pour que l'agent prenne des appels, ou demandez une démo à l'équipe."
        : "Votre abonnement a expiré : renouvelez-le pour que l'agent reprenne les appels.",
      action: { label: "Facturation", href: "/billing" },
    },
  ];

  const live = agent.status === "active" && hasChannel && sub.status !== "expired";
  const progress = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  return { steps, live, phone, widgetSites, progress };
}
