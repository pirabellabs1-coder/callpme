/** Catalogue des intégrations disponibles (données pures, client-safe). */
export interface IntegrationInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string; // nom Lucide
}

export const INTEGRATION_CATALOG: IntegrationInfo[] = [
  {
    id: "google_calendar",
    name: "Google Agenda",
    category: "Agenda",
    description: "Synchronisez les rendez-vous pris par vos agents.",
    icon: "CalendarClock",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Créez et mettez à jour des contacts automatiquement.",
    icon: "Users",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Poussez les leads qualifiés vers votre CRM.",
    icon: "Cloud",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "CRM",
    description: "Synchronisez vos opportunités commerciales.",
    icon: "TrendingUp",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Notifications",
    description: "Recevez les alertes d'appels dans vos canaux.",
    icon: "Hash",
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "Automatisation",
    description: "Connectez Callpme à plus de 6000 applications.",
    icon: "Zap",
  },
];
