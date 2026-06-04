import {
  LayoutDashboard,
  Bot,
  Megaphone,
  PhoneCall,
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

export const PRIMARY_NAV: NavItem[] = [
  { href: "/overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot, match: "/agents" },
  { href: "/campaigns", label: "Campagnes", icon: Megaphone, match: "/campaigns" },
  { href: "/calls", label: "Appels", icon: PhoneCall, match: "/calls" },
  { href: "/analytics", label: "Statistiques", icon: BarChart3 },
];

export const AGENCY_NAV: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/numbers", label: "Numéros", icon: Hash },
  { href: "/voices", label: "Studio Voix", icon: AudioLines },
  { href: "/knowledge", label: "Connaissances", icon: BookOpen, match: "/knowledge" },
];

export const SYSTEM_NAV: NavItem[] = [
  { href: "/integrations", label: "Intégrations", icon: Plug },
  { href: "/developers", label: "Développeurs", icon: Code2, match: "/developers" },
  { href: "/billing", label: "Facturation", icon: CreditCard },
  { href: "/settings", label: "Réglages", icon: Settings },
];
