/**
 * Registre des outils d'agent (function calling) — DÉFINITIONS uniquement.
 *
 * Module pur, importable côté client (sélecteur d'outils, affichage des
 * appels). Les actions réelles (agenda, CRM, SMS…) sont dans `handlers.ts`,
 * exécutées côté serveur seulement.
 */
import type { AgentToolDef } from "../shared/types";

const TOOLS: AgentToolDef[] = [
  /* ----------------------------- Téléphonie ----------------------------- */
  {
    name: "transferToHuman",
    label: "Transférer à un humain",
    description:
      "Transfère l'appel en cours à un conseiller humain. À utiliser quand l'appelant le demande ou quand la demande dépasse ton périmètre.",
    category: "telephonie",
    icon: "PhoneForwarded",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Motif du transfert, résumé en une phrase." },
        department: { type: "string", description: "Service cible si connu (ex: facturation, technique)." },
      },
      required: ["reason"],
    },
  },
  {
    name: "endCall",
    label: "Terminer l'appel",
    description:
      "Termine l'appel. Avant de l'appeler, dis au revoir et assure-toi d'avoir communiqué à l'appelant les informations utiles (référence de rendez-vous, prochaine étape). Ne l'appelle pas dans la même réponse qu'une réservation.",
    category: "telephonie",
    icon: "PhoneOff",
    terminal: true,
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Résumé en une à deux phrases de l'appel et de son issue." },
      },
      required: [],
    },
  },
  {
    name: "routeCall",
    label: "Router l'appel",
    description:
      "Oriente l'appel vers un service. Si un transfert direct n'est pas possible, prends un message pour ce service.",
    category: "telephonie",
    icon: "Network",
    parameters: {
      type: "object",
      properties: { target: { type: "string", description: "Service ou personne cible." } },
      required: ["target"],
    },
  },
  {
    name: "takeMessage",
    label: "Prendre un message",
    description:
      "Enregistre un message pour l'équipe quand le destinataire est indisponible (nom, numéro de rappel, contenu). L'équipe est notifiée.",
    category: "telephonie",
    icon: "MessageSquare",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de l'appelant." },
        phone: { type: "string", description: "Numéro de rappel (par défaut, celui de l'appelant)." },
        message: { type: "string", description: "Contenu du message." },
        recipient: { type: "string", description: "Destinataire ou service, si précisé." },
      },
      required: ["name", "message"],
    },
  },
  {
    name: "sendSms",
    label: "Envoyer un SMS à l'appelant",
    description:
      "Envoie un SMS au numéro de l'appelant (adresse, lien, récapitulatif). Demande toujours son accord avant.",
    category: "communication",
    icon: "MessageSquareText",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Contenu du SMS (court, 300 caractères max)." } },
      required: ["text"],
    },
  },

  {
    name: "optOut",
    label: "Ne plus appeler",
    description:
      "Inscrit le numéro de l'appelant sur la liste d'opposition quand il demande à ne plus être appelé. Confirme-lui ensuite poliment.",
    category: "telephonie",
    icon: "PhoneOff",
    parameters: {
      type: "object",
      properties: { reason: { type: "string", description: "Formulation de la demande, en quelques mots." } },
      required: [],
    },
  },

  /* ------------------------------- Agenda ------------------------------- */
  {
    name: "checkAvailability",
    label: "Vérifier les disponibilités",
    description:
      "Renvoie les créneaux libres pour une date (AAAA-MM-JJ). Appelle-le avant de proposer un horaire ; ne propose que les créneaux renvoyés.",
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
  },
  {
    name: "bookAppointment",
    label: "Prendre un rendez-vous",
    description:
      "Réserve un créneau après accord explicite de l'appelant sur la date et l'heure. Une seule fois par rendez-vous : si l'outil répond qu'un rendez-vous existe déjà, ne réserve pas à nouveau (confirme l'existant, ou annule-le puis réserve pour le déplacer). Renvoie une référence (RDV-…) : annonce-la une fois, sans l'épeler sauf si l'appelant le demande.",
    category: "agenda",
    icon: "CalendarPlus",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du client." },
        date: { type: "string", description: "Date (AAAA-MM-JJ)." },
        time: { type: "string", description: "Heure (HH:MM)." },
        phone: { type: "string", description: "Téléphone du client si différent du numéro appelant." },
        email: { type: "string", description: "E-mail si fourni." },
        notes: { type: "string", description: "Motif du rendez-vous." },
        another: {
          type: "boolean",
          description: "true seulement si l'appelant a déjà un rendez-vous à venir et confirme en vouloir un SECOND en plus.",
        },
      },
      required: ["name", "date", "time"],
    },
  },
  {
    name: "cancelAppointment",
    label: "Annuler un rendez-vous",
    description:
      "Annule un rendez-vous à venir, par sa référence (RDV-…) ou à défaut le prochain rendez-vous du numéro appelant. Pour déplacer : annuler puis réserver.",
    category: "agenda",
    icon: "CalendarX",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Référence du rendez-vous (RDV-XXXXX)." },
        name: { type: "string", description: "Nom sous lequel le rendez-vous a été pris (demande-le si tu as une référence)." },
      },
      required: [],
    },
  },

  /* -------------------------------- CRM --------------------------------- */
  {
    name: "saveToCRM",
    label: "Enregistrer le contact",
    description:
      "Crée ou complète la fiche du contact (nom, e-mail, téléphone, besoin). Synchronisée avec le CRM connecté.",
    category: "crm",
    icon: "UserPlus",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du contact." },
        email: { type: "string", description: "E-mail si fourni." },
        phone: { type: "string", description: "Téléphone (par défaut, celui de l'appelant)." },
        notes: { type: "string", description: "Résumé du besoin." },
      },
      required: ["name"],
    },
  },
  {
    name: "scoreLead",
    label: "Qualifier le prospect",
    description:
      "Calcule un score de qualification (0–100) à partir du besoin, du budget et de l'échéance, et l'enregistre sur la fiche.",
    category: "crm",
    icon: "Gauge",
    parameters: {
      type: "object",
      properties: {
        need: { type: "string", description: "Besoin exprimé." },
        budget: { type: "string", description: "Budget estimé." },
        timeline: { type: "string", description: "Échéance d'achat." },
        name: { type: "string", description: "Nom du prospect, si connu." },
      },
      required: ["need"],
    },
  },
  {
    name: "scheduleCallback",
    label: "Planifier un rappel",
    description: "Programme un rappel par l'équipe à un moment convenu. L'équipe est notifiée.",
    category: "crm",
    icon: "PhoneCall",
    parameters: {
      type: "object",
      properties: {
        when: { type: "string", description: "Date et heure du rappel (AAAA-MM-JJ HH:MM)." },
        phone: { type: "string", description: "Numéro à rappeler (par défaut, celui de l'appelant)." },
        name: { type: "string", description: "Nom de la personne." },
        reason: { type: "string", description: "Objet du rappel." },
      },
      required: ["when"],
    },
  },
  {
    name: "markInterested",
    label: "Marquer comme intéressé",
    description: "Indique le niveau d'intérêt du contact pour un suivi prioritaire.",
    category: "crm",
    icon: "Star",
    parameters: {
      type: "object",
      properties: {
        level: { type: "string", description: "Niveau d'intérêt.", enum: ["faible", "moyen", "fort"] },
        name: { type: "string", description: "Nom du contact, si connu." },
      },
      required: [],
    },
  },

  /* ------------------------------ Commerce ------------------------------ */
  {
    name: "lookupOrder",
    label: "Retrouver une commande",
    description:
      "Recherche une commande via le système de l'entreprise (fonction personnalisée). Sans système connecté, propose de prendre un message.",
    category: "commerce",
    icon: "PackageSearch",
    parameters: {
      type: "object",
      properties: { orderId: { type: "string", description: "Numéro de commande." } },
      required: ["orderId"],
    },
  },
  {
    name: "createTicket",
    label: "Ouvrir un ticket",
    description: "Crée un ticket de support pour un problème non résolu pendant l'appel. L'équipe est notifiée.",
    category: "commerce",
    icon: "Ticket",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Objet du ticket." },
        details: { type: "string", description: "Description du problème." },
        priority: { type: "string", description: "Priorité.", enum: ["basse", "normale", "haute", "urgente"] },
        name: { type: "string", description: "Nom de l'appelant." },
      },
      required: ["subject"],
    },
  },

  /* ------------------------------ Paiement ------------------------------ */
  {
    name: "requestPayment",
    label: "Encaisser un paiement",
    description:
      "Envoie à l'appelant, par SMS ou WhatsApp, un lien de paiement sécurisé (Mobile Money ou carte) au profit de l'entreprise. Avant de l'appeler : annonce clairement le montant et le motif, et obtiens l'accord explicite de l'appelant. Utilise un tarif de l'entreprise (item) ; sans tarif connu, appelle-le sans montant pour obtenir la liste. Ne demande jamais de code, de mot de passe ni de numéro de carte : le paiement se fait uniquement sur la page du lien.",
    category: "paiement",
    icon: "Wallet",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "Prestation ou produit, tel que nommé dans les tarifs de l'entreprise." },
        amount: { type: "number", description: "Montant, seulement si l'entreprise autorise les montants libres (dans sa devise : FCFA ou euros)." },
        reason: { type: "string", description: "Motif du paiement en quelques mots (ex : consultation du 12 mars)." },
      },
      required: ["reason"],
    },
  },
  {
    name: "checkPayment",
    label: "Vérifier un paiement",
    description:
      "Vérifie si l'appelant a payé le lien envoyé pendant cet appel. Annonce « paiement reçu » seulement si cet outil le confirme.",
    category: "paiement",
    icon: "BadgeCheck",
    parameters: { type: "object", properties: {}, required: [] },
  },

  /* --------------------------- Communication ---------------------------- */
  {
    name: "sendFollowUpEmail",
    label: "Envoyer un e-mail de suivi",
    description:
      "Envoie à l'appelant un e-mail récapitulant l'appel. Fais épeler et confirmer l'adresse avant.",
    category: "communication",
    icon: "Mail",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Adresse e-mail confirmée de l'appelant." },
        summary: { type: "string", description: "Récapitulatif et prochaines étapes (quelques phrases)." },
      },
      required: ["to", "summary"],
    },
  },
  {
    name: "logCall",
    label: "Journaliser l'appel",
    description: "Note l'issue de l'appel (visible dans la fiche de l'appel).",
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
  },

  /* ------------------------------ Système ------------------------------- */
  {
    name: "recordAnswer",
    label: "Enregistrer une réponse",
    description: "Enregistre la réponse de la personne à une question d'enquête.",
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
  },
  {
    name: "submitSurvey",
    label: "Soumettre l'enquête",
    description: "Clôture l'enquête avec un score global.",
    category: "systeme",
    icon: "ClipboardCheck",
    terminal: true,
    parameters: {
      type: "object",
      properties: { score: { type: "integer", description: "Score global (ex: NPS)." } },
      required: [],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  API du registre                                                    */
/* ------------------------------------------------------------------ */

export const TOOL_REGISTRY: Record<string, AgentToolDef> = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

/** Toutes les définitions pour l'UI. */
export const ALL_TOOLS: AgentToolDef[] = TOOLS;

export function getTool(name: string): AgentToolDef | undefined {
  return TOOL_REGISTRY[name];
}

/** Résout une liste de noms en définitions, en ignorant les inconnus. */
export function resolveTools(names: string[]): AgentToolDef[] {
  return names.map((n) => TOOL_REGISTRY[n]).filter(Boolean);
}

/** Regroupe les outils par catégorie pour l'affichage. */
export function toolsByCategory(): Record<string, AgentToolDef[]> {
  return ALL_TOOLS.reduce<Record<string, AgentToolDef[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});
}

export const TOOL_CATEGORY_LABELS: Record<string, string> = {
  telephonie: "Téléphonie",
  agenda: "Agenda",
  crm: "CRM",
  commerce: "Commerce",
  paiement: "Paiement",
  communication: "Communication",
  systeme: "Système",
};
