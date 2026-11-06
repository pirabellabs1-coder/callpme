/** Catalogue des intégrations disponibles (données pures, client-safe). */
export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  /** « password » masque la saisie (jetons/clés). Défaut : password. */
  type?: "text" | "password";
  required?: boolean;
  /** Format attendu (expression régulière) et message si la saisie ne correspond pas. */
  pattern?: string;
  patternHint?: string;
}

export interface IntegrationInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string; // nom Lucide
  /** Libellé du compte/espace demandé (ex. « Espace de travail »). */
  accountLabel: string;
  /** Identifiants réels à saisir pour établir la connexion. */
  fields: IntegrationField[];
  /** Page officielle où récupérer la clé/jeton (s'ouvre dans un onglet). */
  docsUrl: string;
  /** Connexion par OAuth (bouton « Connecter ») plutôt que par saisie d'identifiants. */
  oauth?: { connectUrl: string; label: string };
  /** Ce que Callpme fait réellement avec l'intégration (absent = identifiants stockés seulement). */
  live?: string;
  /** Pas encore disponible : affichée mais non connectable. */
  comingSoon?: boolean;
}

export const INTEGRATION_CATALOG: IntegrationInfo[] = [
  {
    id: "google_calendar",
    name: "Google Agenda",
    category: "Agenda",
    description: "Synchronisez les rendez-vous pris par vos agents.",
    icon: "CalendarClock",
    accountLabel: "Compte Google",
    fields: [],
    docsUrl: "https://myaccount.google.com/permissions",
    oauth: { connectUrl: "/api/integrations/google/connect", label: "Connecter avec Google" },
    live: "Créneaux occupés pris en compte, rendez-vous ajoutés et retirés automatiquement.",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Créez et mettez à jour des contacts automatiquement.",
    live: "Chaque prospect est créé ou complété dans HubSpot, avec une note d'appel.",
    icon: "Users",
    accountLabel: "Portail HubSpot",
    fields: [
      {
        key: "access_token",
        label: "Jeton d'application privée",
        placeholder: "pat-eu1-…",
        type: "password",
        required: true,
      },
    ],
    docsUrl: "https://app.hubspot.com/private-apps",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Poussez les leads qualifiés vers votre CRM.",
    comingSoon: true,
    icon: "Cloud",
    accountLabel: "Org Salesforce",
    fields: [
      { key: "access_token", label: "Jeton d'accès", type: "password", required: true },
      {
        key: "instance_url",
        label: "URL d'instance",
        placeholder: "https://votre-domaine.my.salesforce.com",
        type: "text",
        required: true,
      },
    ],
    docsUrl: "https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "CRM",
    description: "Synchronisez vos opportunités commerciales.",
    live: "Chaque prospect est créé dans Pipedrive, avec une note d'appel.",
    icon: "TrendingUp",
    accountLabel: "Compte Pipedrive",
    fields: [
      { key: "api_token", label: "Jeton API", type: "password", required: true },
    ],
    docsUrl: "https://app.pipedrive.com/settings/api",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Notifications",
    description: "Recevez les alertes d'appels dans vos canaux.",
    live: "Chaque appel terminé, prospect et rendez-vous est publié dans le canal choisi.",
    icon: "Hash",
    accountLabel: "Canal Slack",
    fields: [
      {
        key: "webhook_url",
        label: "URL du webhook entrant",
        placeholder: "https://hooks.slack.com/services/…",
        type: "password",
        required: true,
        pattern: "^https://hooks\\.slack\\.com/services/[A-Za-z0-9/_-]+$",
        patternHint: "L'adresse doit commencer par https://hooks.slack.com/services/",
      },
    ],
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
  {
    id: "zapier",
    name: "Zapier · Make · n8n",
    category: "Automatisation",
    description: "Connectez Callpme à des milliers d'applications (Google Sheets, WhatsApp Business, e-mail…).",
    live: "Chaque appel terminé, prospect et rendez-vous déclenche votre scénario, avec toutes ses données.",
    icon: "Zap",
    accountLabel: "Scénario",
    fields: [
      {
        key: "webhook_url",
        label: "URL du webhook (Zapier « Catch Hook », Make « Custom webhook », n8n « Webhook »)",
        placeholder: "https://hooks.zapier.com/hooks/catch/…",
        type: "password",
        required: true,
        pattern: "^https://[^\\s]+$",
        patternHint: "L'adresse doit commencer par https://",
      },
    ],
    docsUrl: "https://zapier.com/app/zaps",
  },
];

export function getIntegration(id: string): IntegrationInfo | undefined {
  return INTEGRATION_CATALOG.find((i) => i.id === id);
}
