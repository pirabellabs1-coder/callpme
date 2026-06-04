/** Modèles d'agents prêts à l'emploi, par secteur. */
import type { AgentRole } from "../shared/types";

export interface AgentTemplate {
  id: string;
  name: string;
  industry: string;
  role: AgentRole;
  icon: string;
  description: string;
  firstMessage: string;
  persona: string;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "clinic",
    name: "Secrétaire médicale",
    industry: "Santé",
    role: "appointment",
    icon: "Stethoscope",
    description: "Prend, déplace et annule les rendez-vous d'un cabinet.",
    firstMessage:
      "Cabinet médical, bonjour. Souhaitez-vous prendre, déplacer ou annuler un rendez-vous ?",
    persona: "Douce et rassurante, confirme chaque détail avec soin.",
  },
  {
    id: "restaurant",
    name: "Réservation restaurant",
    industry: "Restauration",
    role: "appointment",
    icon: "UtensilsCrossed",
    description: "Gère les réservations de table et les demandes spéciales.",
    firstMessage:
      "Bonjour et bienvenue ! Souhaitez-vous réserver une table ? Pour combien de personnes ?",
    persona: "Chaleureuse et accueillante, met le client à l'aise.",
  },
  {
    id: "ecommerce",
    name: "Support e-commerce",
    industry: "E-commerce",
    role: "support",
    icon: "ShoppingBag",
    description: "Suivi de commande, retours et questions produits.",
    firstMessage:
      "Bonjour, vous êtes au service client. Que puis-je faire pour vous aujourd'hui ?",
    persona: "Patiente et efficace, va droit à la solution.",
  },
  {
    id: "realestate",
    name: "Qualification immobilier",
    industry: "Immobilier",
    role: "lead_qualification",
    icon: "Home",
    description: "Qualifie les acheteurs/locataires entrants.",
    firstMessage:
      "Bonjour, merci pour votre intérêt ! Quelques questions rapides pour vous orienter.",
    persona: "Dynamique et à l'écoute, cerne vite le besoin.",
  },
  {
    id: "saas-sales",
    name: "Vente SaaS sortante",
    industry: "Tech",
    role: "outbound_sales",
    icon: "Rocket",
    description: "Prospection et démo pour un produit logiciel.",
    firstMessage:
      "Bonjour, je vous appelle au sujet de votre essai récent — vous avez deux minutes ?",
    persona: "Enthousiaste mais respectueux, sait écouter les objections.",
  },
  {
    id: "reception",
    name: "Standard d'entreprise",
    industry: "Tous secteurs",
    role: "receptionist",
    icon: "Headset",
    description: "Accueille et oriente tous les appels entrants.",
    firstMessage:
      "Bonjour, vous êtes bien à l'accueil. Qui souhaitez-vous joindre ?",
    persona: "Professionnel et neutre, oriente rapidement.",
  },
];

export function getTemplate(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id);
}
