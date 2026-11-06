import {
  LayoutDashboard,
  Rocket,
  MessageCircle,
  Radio,
  Bot,
  LayoutTemplate,
  Megaphone,
  PhoneCall,
  CalendarDays,
  Inbox,
  BarChart3,
  Building2,
  Hash,
  AudioLines,
  BookOpen,
  Plug,
  Code2,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Correspondance de préfixe pour l'état actif. */
  match?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  /** Réservé à l'offre Agence. */
  agencyOnly?: boolean;
}

/**
 * Navigation organisée par usage :
 *  - Piloter : ce qui se passe et ce qu'il faut traiter ;
 *  - Construire : les agents et ce qui les alimente ;
 *  - Configurer : le branchement (numéros, outils, compte).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "pilot",
    label: "Piloter",
    items: [
      { href: "/start", label: "Bien démarrer", icon: Rocket },
      { href: "/overview", label: "Vue d'ensemble", icon: LayoutDashboard },
      { href: "/calls", label: "Appels", icon: PhoneCall, match: "/calls" },
      { href: "/conversations", label: "Conversations", icon: MessageCircle },
      { href: "/appointments", label: "Rendez-vous", icon: CalendarDays },
      { href: "/leads", label: "Prospects", icon: Inbox },
      { href: "/analytics", label: "Statistiques", icon: BarChart3 },
    ],
  },
  {
    id: "build",
    label: "Construire",
    items: [
      { href: "/agents", label: "Agents", icon: Bot, match: "/agents" },
      { href: "/templates", label: "Modèles", icon: LayoutTemplate },
      { href: "/campaigns", label: "Campagnes", icon: Megaphone, match: "/campaigns" },
      { href: "/knowledge", label: "Connaissances", icon: BookOpen, match: "/knowledge" },
      { href: "/voices", label: "Voix", icon: AudioLines },
    ],
  },
  {
    id: "agency",
    label: "Agence",
    agencyOnly: true,
    items: [{ href: "/clients", label: "Clients", icon: Building2 }],
  },
  {
    id: "setup",
    label: "Configurer",
    items: [
      { href: "/channels", label: "Canaux", icon: Radio },
      { href: "/numbers", label: "Numéros", icon: Hash },
      { href: "/integrations", label: "Intégrations", icon: Plug },
      { href: "/developers", label: "Développeurs", icon: Code2, match: "/developers" },
      { href: "/billing", label: "Facturation", icon: CreditCard },
      { href: "/settings", label: "Réglages", icon: Settings },
    ],
  },
];

/** Liste à plat (palette de commandes, recherche). */
export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
