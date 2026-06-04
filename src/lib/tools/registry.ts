/**
 * Registre des outils d'agent (function calling).
 *
 * Chaque outil est exposé au LLM via son `name`, sa `description` et son
 * schéma de `parameters`. Les `handler` sont ici des mocks réalistes
 * (log + données simulées) ; ils seront remplacés en Phase 3 par de vraies
 * intégrations (Twilio, Google Calendar, CRM…) sans changer l'interface.
 */
import type {
  AgentToolDef,
  ToolContext,
  ToolResult,
} from "../shared/types";

export interface AgentToolImpl extends AgentToolDef {
  handler: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<ToolResult>;
}

/* Petit utilitaire de référence mock déterministe-ish. */
function ref(prefix: string): string {
  const n = Math.floor(Math.random() * 900000 + 100000);
  return `${prefix}-${n}`;
}

const TOOLS: AgentToolImpl[] = [
  /* ----------------------------- Téléphonie ----------------------------- */
  {
    name: "transferToHuman",
    label: "Transférer à un humain",
    description:
      "Transfère l'appel en cours à un agent humain ou à un service. À utiliser quand la demande dépasse le périmètre de l'agent.",
    category: "telephonie",
    icon: "PhoneForwarded",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motif du transfert, résumé en une phrase.",
        },
        department: {
          type: "string",
          description: "Service cible si connu (ex: facturation, technique).",
        },
      },
      required: ["reason"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Transfert initié vers un conseiller (motif : ${args.reason ?? "non précisé"}).`,
      data: { transferred: true, queue: args.department ?? "general" },
    }),
  },
  {
    name: "endCall",
    label: "Terminer l'appel",
    description:
      "Termine proprement l'appel après avoir résumé ce qui a été fait. Toujours appeler en fin de conversation.",
    category: "telephonie",
    icon: "PhoneOff",
    terminal: true,
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Résumé en une à deux phrases de l'appel et de son issue.",
        },
      },
      required: ["summary"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Appel terminé. ${args.summary ?? ""}`.trim(),
      data: { ended: true },
    }),
  },
  {
    name: "routeCall",
    label: "Router l'appel",
    description:
      "Oriente l'appel vers le bon service ou la bonne personne (standard).",
    category: "telephonie",
    icon: "Network",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Service ou personne cible.",
        },
      },
      required: ["target"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Appel routé vers ${args.target}.`,
      data: { routedTo: args.target },
    }),
  },
  {
    name: "takeMessage",
    label: "Prendre un message",
    description:
      "Enregistre un message quand le destinataire est indisponible (nom, numéro, objet).",
    category: "telephonie",
    icon: "MessageSquare",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de l'appelant." },
        phone: { type: "string", description: "Numéro de rappel." },
        message: { type: "string", description: "Contenu du message." },
      },
      required: ["name", "message"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Message pris pour rappel : « ${args.message} » (${args.name}).`,
      data: { messageId: ref("MSG") },
    }),
  },

  /* ------------------------------- Agenda ------------------------------- */
  {
    name: "checkAvailability",
    label: "Vérifier les disponibilités",
    description:
      "Renvoie les créneaux disponibles pour une date donnée. À appeler avant de proposer un horaire.",
    category: "agenda",
    icon: "CalendarSearch",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date souhaitée (AAAA-MM-JJ)." },
        partOfDay: {
          type: "string",
          description: "Préférence : matin, après-midi, soir.",
          enum: ["matin", "apres-midi", "soir"],
        },
      },
      required: ["date"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Créneaux trouvés pour le ${args.date}.`,
      data: { date: args.date, slots: ["09:30", "11:00", "14:15", "16:45"] },
    }),
  },
  {
    name: "bookAppointment",
    label: "Prendre un rendez-vous",
    description:
      "Enregistre un rendez-vous après confirmation du nom, de la date et de l'heure.",
    category: "agenda",
    icon: "CalendarPlus",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du client." },
        date: { type: "string", description: "Date (AAAA-MM-JJ)." },
        time: { type: "string", description: "Heure (HH:MM)." },
      },
      required: ["name", "date", "time"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Rendez-vous confirmé pour ${args.name} le ${args.date} à ${args.time}.`,
      data: { appointmentId: ref("RDV"), ...args },
    }),
  },
  {
    name: "cancelAppointment",
    label: "Annuler un rendez-vous",
    description: "Annule ou déplace un rendez-vous existant.",
    category: "agenda",
    icon: "CalendarX",
    parameters: {
      type: "object",
      properties: {
        appointmentId: { type: "string", description: "Référence du RDV." },
        name: { type: "string", description: "Nom du client (à défaut d'ID)." },
      },
      required: [],
    },
    handler: async (args) => ({
      ok: true,
      message: `Rendez-vous annulé (${args.appointmentId ?? args.name ?? "réf. inconnue"}).`,
      data: { cancelled: true },
    }),
  },

  /* -------------------------------- CRM --------------------------------- */
  {
    name: "saveToCRM",
    label: "Enregistrer dans le CRM",
    description:
      "Crée ou met à jour une fiche prospect/client dans le CRM avec les informations collectées.",
    category: "crm",
    icon: "UserPlus",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du contact." },
        email: { type: "string", description: "E-mail si fourni." },
        phone: { type: "string", description: "Téléphone." },
        notes: { type: "string", description: "Résumé du besoin." },
      },
      required: ["name"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Fiche CRM enregistrée pour ${args.name}.`,
      data: { contactId: ref("CRM") },
    }),
  },
  {
    name: "scoreLead",
    label: "Scorer le lead",
    description:
      "Évalue la qualité d'un prospect (score 0–100) selon le besoin, le budget et l'échéance.",
    category: "crm",
    icon: "Gauge",
    parameters: {
      type: "object",
      properties: {
        budget: { type: "string", description: "Budget estimé." },
        timeline: { type: "string", description: "Échéance d'achat." },
        need: { type: "string", description: "Besoin exprimé." },
      },
      required: ["need"],
    },
    handler: async (args) => {
      const score = 40 + Math.floor(Math.random() * 55);
      return {
        ok: true,
        message: `Lead scoré à ${score}/100.`,
        data: { score, temperature: score >= 70 ? "chaud" : "tiède", ...args },
      };
    },
  },
  {
    name: "scheduleCallback",
    label: "Planifier un rappel",
    description: "Programme un rappel par un commercial à un moment donné.",
    category: "crm",
    icon: "PhoneCall",
    parameters: {
      type: "object",
      properties: {
        when: { type: "string", description: "Date/heure souhaitée du rappel." },
        phone: { type: "string", description: "Numéro à rappeler." },
      },
      required: ["when"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Rappel planifié pour ${args.when}.`,
      data: { callbackId: ref("CB"), ...args },
    }),
  },
  {
    name: "markInterested",
    label: "Marquer comme intéressé",
    description: "Marque le contact comme intéressé pour un suivi prioritaire.",
    category: "crm",
    icon: "Star",
    parameters: {
      type: "object",
      properties: {
        level: {
          type: "string",
          description: "Niveau d'intérêt.",
          enum: ["faible", "moyen", "fort"],
        },
      },
      required: [],
    },
    handler: async (args) => ({
      ok: true,
      message: `Contact marqué intéressé (${args.level ?? "moyen"}).`,
      data: { interested: true, level: args.level ?? "moyen" },
    }),
  },

  /* ------------------------------ Commerce ------------------------------ */
  {
    name: "lookupOrder",
    label: "Retrouver une commande",
    description:
      "Recherche une commande par son numéro et renvoie son statut et son contenu.",
    category: "commerce",
    icon: "PackageSearch",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Numéro de commande." },
      },
      required: ["orderId"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Commande ${args.orderId} retrouvée — statut : expédiée.`,
      data: {
        orderId: args.orderId,
        status: "expédiée",
        carrier: "Colissimo",
        eta: "2 jours ouvrés",
      },
    }),
  },
  {
    name: "createTicket",
    label: "Ouvrir un ticket",
    description:
      "Crée un ticket de support pour un problème non résolu pendant l'appel.",
    category: "commerce",
    icon: "Ticket",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Objet du ticket." },
        priority: {
          type: "string",
          description: "Priorité.",
          enum: ["basse", "normale", "haute", "urgente"],
        },
      },
      required: ["subject"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Ticket ouvert : « ${args.subject} » (priorité ${args.priority ?? "normale"}).`,
      data: { ticketId: ref("TIC"), ...args },
    }),
  },

  /* --------------------------- Communication ---------------------------- */
  {
    name: "sendFollowUpEmail",
    label: "Envoyer un e-mail de suivi",
    description:
      "Envoie un e-mail de suivi récapitulant l'appel et les prochaines étapes.",
    category: "communication",
    icon: "Mail",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Adresse e-mail du destinataire." },
        template: {
          type: "string",
          description: "Modèle d'e-mail.",
          enum: ["recapitulatif", "offre", "confirmation"],
        },
      },
      required: ["to"],
    },
    handler: async (args) => ({
      ok: true,
      message: `E-mail de suivi envoyé à ${args.to}.`,
      data: { emailId: ref("EML") },
    }),
  },
  {
    name: "logCall",
    label: "Journaliser l'appel",
    description: "Enregistre l'issue et les notes de l'appel sortant.",
    category: "communication",
    icon: "NotebookPen",
    parameters: {
      type: "object",
      properties: {
        outcome: { type: "string", description: "Issue de l'appel." },
        notes: { type: "string", description: "Notes libres." },
      },
      required: ["outcome"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Appel journalisé (${args.outcome}).`,
      data: { logId: ref("LOG") },
    }),
  },

  /* ------------------------------ Système ------------------------------- */
  {
    name: "recordAnswer",
    label: "Enregistrer une réponse",
    description:
      "Enregistre la réponse de la personne à une question d'enquête.",
    category: "systeme",
    icon: "ListChecks",
    parameters: {
      type: "object",
      properties: {
        questionId: { type: "string", description: "Identifiant de la question." },
        answer: { type: "string", description: "Réponse donnée." },
      },
      required: ["questionId", "answer"],
    },
    handler: async (args) => ({
      ok: true,
      message: `Réponse enregistrée pour ${args.questionId}.`,
      data: { recorded: true },
    }),
  },
  {
    name: "submitSurvey",
    label: "Soumettre l'enquête",
    description: "Clôture et soumet l'ensemble des réponses de l'enquête.",
    category: "systeme",
    icon: "ClipboardCheck",
    terminal: true,
    parameters: {
      type: "object",
      properties: {
        score: { type: "integer", description: "Score global (ex: NPS)." },
      },
      required: [],
    },
    handler: async (args) => ({
      ok: true,
      message: `Enquête soumise${args.score != null ? ` (score ${args.score})` : ""}.`,
      data: { surveyId: ref("SRV") },
    }),
  },
];

/* ------------------------------------------------------------------ */
/*  API du registre                                                    */
/* ------------------------------------------------------------------ */

export const TOOL_REGISTRY: Record<string, AgentToolImpl> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
);

/** Toutes les définitions (sans les handlers) pour l'UI. */
export const ALL_TOOLS: AgentToolDef[] = TOOLS.map(
  ({ handler: _handler, ...def }) => def,
);

export function getTool(name: string): AgentToolImpl | undefined {
  return TOOL_REGISTRY[name];
}

/** Résout une liste de noms en définitions, en ignorant les inconnus. */
export function resolveTools(names: string[]): AgentToolDef[] {
  return names
    .map((n) => TOOL_REGISTRY[n])
    .filter(Boolean)
    .map(({ handler: _handler, ...def }) => def);
}

/** Regroupe les outils par catégorie pour l'affichage. */
export function toolsByCategory(): Record<string, AgentToolDef[]> {
  return ALL_TOOLS.reduce<Record<string, AgentToolDef[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});
}

/** Exécute un outil (utilisé par le pipeline vocal en Phase 3). */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = TOOL_REGISTRY[name];
  if (!tool) {
    return { ok: false, message: `Outil inconnu : ${name}` };
  }
  return tool.handler(args, ctx);
}

export const TOOL_CATEGORY_LABELS: Record<string, string> = {
  telephonie: "Téléphonie",
  agenda: "Agenda",
  crm: "CRM",
  commerce: "Commerce",
  communication: "Communication",
  systeme: "Système",
};
