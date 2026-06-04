/**
 * Catalogue des rôles d'agent — le cœur différenciant de Callpme.
 *
 * Chaque rôle porte : un libellé et une description FR, une icône Lucide,
 * une teinte sobre dédiée (pas de couleur criarde), ses outils par défaut,
 * un premier message suggéré et des exemples d'usage.
 *
 * Module de DONNÉES pur (aucun import React/Lucide) → réutilisable côté
 * serveur (génération de prompt, seed) comme côté client (UI).
 */
import type { AgentRole } from "../shared/types";

export interface RoleMeta {
  key: AgentRole;
  /** Libellé court (badge, titre de carte). */
  label: string;
  /** Accroche d'une ligne. */
  tagline: string;
  /** Description complète (sélecteur de rôle). */
  description: string;
  /** Nom de l'icône Lucide (résolu côté UI). */
  icon: string;
  /** Outils activés par défaut à la création. */
  defaultTools: string[];
  /** Premier message suggéré (l'agent décroche). */
  firstMessage: string;
  /** Direction d'appel typique. */
  direction: "inbound" | "outbound" | "both";
  /** Exemples concrets d'usage (UI). */
  examples: string[];
  /** Teinte sobre — classes Tailwind pré-composées. */
  badgeClass: string;
  softClass: string;
  dotClass: string;
  iconWrapClass: string;
}

export const ROLE_META: Record<AgentRole, RoleMeta> = {
  support: {
    key: "support",
    label: "Support client",
    tagline: "Répond, diagnostique et résout les demandes entrantes.",
    description:
      "Prend en charge les questions courantes, retrouve les commandes, ouvre des tickets et transfère à un humain quand c'est nécessaire. Idéal pour décharger un service client.",
    icon: "LifeBuoy",
    defaultTools: ["lookupOrder", "createTicket", "transferToHuman", "endCall"],
    firstMessage:
      "Bonjour, vous êtes bien au support. Je suis là pour vous aider — que puis-je faire pour vous ?",
    direction: "inbound",
    examples: [
      "Suivi de commande et retours",
      "Questions sur un abonnement",
      "Première qualification d'incident",
    ],
    badgeClass: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15",
    softClass: "bg-sky-50/70 text-sky-700",
    dotClass: "bg-sky-500",
    iconWrapClass: "bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-600/15",
  },
  appointment: {
    key: "appointment",
    label: "Prise de rendez-vous",
    tagline: "Planifie, déplace et annule des rendez-vous.",
    description:
      "Vérifie les disponibilités, propose des créneaux, confirme les coordonnées et inscrit le rendez-vous dans l'agenda. Parfait pour cabinets, salons et services.",
    icon: "CalendarClock",
    defaultTools: [
      "checkAvailability",
      "bookAppointment",
      "cancelAppointment",
      "transferToHuman",
      "endCall",
    ],
    firstMessage:
      "Bonjour, je vous appelle de la part du cabinet. Souhaitez-vous prendre, déplacer ou annuler un rendez-vous ?",
    direction: "both",
    examples: [
      "Cabinet médical ou paramédical",
      "Salon de coiffure / esthétique",
      "Rappel et confirmation de RDV",
    ],
    badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
    softClass: "bg-emerald-50/70 text-emerald-700",
    dotClass: "bg-emerald-500",
    iconWrapClass:
      "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/15",
  },
  lead_qualification: {
    key: "lead_qualification",
    label: "Qualification de leads",
    tagline: "Qualifie les prospects entrants et score l'intérêt.",
    description:
      "Pose les bonnes questions, évalue le budget et le besoin, enregistre le prospect dans le CRM et planifie un rappel commercial. Maximise le taux de conversion.",
    icon: "Filter",
    defaultTools: ["scoreLead", "saveToCRM", "scheduleCallback", "transferToHuman", "endCall"],
    firstMessage:
      "Bonjour et merci pour votre intérêt ! Quelques questions rapides pour vous orienter vers la bonne personne.",
    direction: "inbound",
    examples: [
      "Formulaire web qui appelle le prospect",
      "Tri des demandes de devis",
      "Pré-qualification BANT",
    ],
    badgeClass: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
    softClass: "bg-amber-50/70 text-amber-700",
    dotClass: "bg-amber-500",
    iconWrapClass: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-600/15",
  },
  outbound_sales: {
    key: "outbound_sales",
    label: "Vente sortante",
    tagline: "Appels sortants de vente, relance et réactivation.",
    description:
      "Contacte une liste de prospects ou de clients, présente l'offre, gère les objections, enregistre l'appel et envoie un e-mail de suivi. Pour les campagnes de prospection.",
    icon: "PhoneOutgoing",
    defaultTools: ["logCall", "sendFollowUpEmail", "markInterested", "scheduleCallback", "endCall"],
    firstMessage:
      "Bonjour, je vous appelle au sujet de votre demande récente — vous avez deux minutes ?",
    direction: "outbound",
    examples: [
      "Relance de paniers abandonnés",
      "Réactivation de clients dormants",
      "Prise de contact sur une liste",
    ],
    badgeClass: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
    softClass: "bg-brand-50/70 text-brand-700",
    dotClass: "bg-brand-500",
    iconWrapClass: "bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/20",
  },
  receptionist: {
    key: "receptionist",
    label: "Standard téléphonique",
    tagline: "Accueille, oriente et prend les messages.",
    description:
      "Décroche tous les appels, identifie la demande, route vers le bon service ou la bonne personne, prend un message en cas d'absence. Le standard qui ne rate jamais un appel.",
    icon: "Headset",
    defaultTools: ["routeCall", "takeMessage", "transferToHuman", "endCall"],
    firstMessage:
      "Bonjour, vous êtes bien à l'accueil. Qui souhaitez-vous joindre, ou comment puis-je vous orienter ?",
    direction: "inbound",
    examples: [
      "Accueil multi-services",
      "Débordement d'appels aux heures de pointe",
      "Permanence en dehors des horaires",
    ],
    badgeClass: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/15",
    softClass: "bg-teal-50/70 text-teal-700",
    dotClass: "bg-teal-500",
    iconWrapClass: "bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-600/15",
  },
  survey: {
    key: "survey",
    label: "Enquête de satisfaction",
    tagline: "Mène des enquêtes téléphoniques structurées.",
    description:
      "Pose une série de questions, enregistre chaque réponse, mesure la satisfaction (NPS / CSAT) et soumet le résultat. Pour le suivi qualité après prestation.",
    icon: "ClipboardCheck",
    defaultTools: ["recordAnswer", "submitSurvey", "endCall"],
    firstMessage:
      "Bonjour, suite à votre passage nous menons une courte enquête de satisfaction — auriez-vous une minute ?",
    direction: "outbound",
    examples: [
      "Enquête post-achat / post-visite",
      "Mesure NPS automatisée",
      "Sondage de rappel produit",
    ],
    badgeClass: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15",
    softClass: "bg-rose-50/70 text-rose-700",
    dotClass: "bg-rose-500",
    iconWrapClass: "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-600/15",
  },
  custom: {
    key: "custom",
    label: "Rôle personnalisé",
    tagline: "Définissez vous-même la mission de l'agent.",
    description:
      "Un rôle entièrement sur-mesure : vous écrivez la mission et le prompt, et vous choisissez les outils et fonctions.",
    icon: "SlidersHorizontal",
    defaultTools: ["transferToHuman", "endCall"],
    firstMessage: "Bonjour, comment puis-je vous aider ?",
    direction: "both",
    examples: [],
    badgeClass: "bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-600/15",
    softClass: "bg-stone-100/70 text-stone-700",
    dotClass: "bg-stone-500",
    iconWrapClass: "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-600/20",
  },
};

/** Ordre d'affichage canonique des rôles PRÉDÉFINIS (vitrine, filtres). */
export const ROLE_ORDER: AgentRole[] = [
  "support",
  "appointment",
  "lead_qualification",
  "outbound_sales",
  "receptionist",
  "survey",
];

export function getRoleMeta(role: AgentRole): RoleMeta {
  return ROLE_META[role];
}

export const ALL_ROLE_META: RoleMeta[] = ROLE_ORDER.map((r) => ROLE_META[r]);
