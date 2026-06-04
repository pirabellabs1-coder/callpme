/**
 * Sélecteur d'outils pour le moteur de dialogue intégré.
 *
 * Le LLM réel déclenche ses outils via le function calling natif. Sans clé
 * d'API, ce module donne au moteur local la même capacité : détecter, à partir
 * du rôle et du dernier message, quel outil activé appeler et avec quels
 * arguments — pour que les fonctions configurées soient *réellement* exécutées
 * pendant un appel de test.
 */
import type { AgentRole } from "../shared/types";
import type { ChatMessage } from "./chat";

export interface LocalToolPick {
  name: string;
  args: Record<string, unknown>;
  /** Réplique privilégiée lorsque l'outil aboutit (sinon réponse de base). */
  reply?: string;
}

const BUILTIN = new Set([
  "transferToHuman",
  "endCall",
  "routeCall",
  "takeMessage",
  "checkAvailability",
  "bookAppointment",
  "cancelAppointment",
  "saveToCRM",
  "scoreLead",
  "scheduleCallback",
  "markInterested",
  "lookupOrder",
  "createTicket",
  "sendFollowUpEmail",
  "logCall",
  "recordAnswer",
  "submitSurvey",
]);

function userTexts(history: ChatMessage[]): string[] {
  return history.filter((m) => m.role === "user").map((m) => m.content);
}

function firstUser(history: ChatMessage[]): string | undefined {
  return userTexts(history)[0];
}

function extractName(history: ChatMessage[]): string | undefined {
  const joined = userTexts(history).join(" ");
  const m =
    joined.match(/\b(?:je m'appelle|c'est|au nom de|nom est|moi c'est)\s+([A-ZÀ-Ÿ][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ÿ][\wÀ-ÿ'-]+)?)/) ||
    joined.match(/\b(?:monsieur|madame|m\.|mme)\s+([A-ZÀ-Ÿ][\wÀ-ÿ'-]+)/i);
  return m?.[1]?.trim();
}

function extractEmail(history: ChatMessage[]): string | undefined {
  return userTexts(history).join(" ").match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
}

function extractPhone(history: ChatMessage[]): string | undefined {
  return userTexts(history)
    .join(" ")
    .match(/(?:\+?\d[\d ().-]{7,}\d)/)?.[0]
    ?.trim();
}

function extractOrderId(text: string): string | undefined {
  return text.match(/\b[A-Z]{0,3}-?\d{4,}\b/)?.[0];
}

function detectDept(u: string): string | undefined {
  if (/commercial|vente|devis/.test(u)) return "commercial";
  if (/support|technique|panne|bug|aide/.test(u)) return "technique";
  if (/comptab|factur|paiement/.test(u)) return "facturation";
  return undefined;
}

/**
 * Décide si un outil doit être appelé ce tour-ci.
 * Retourne null si aucun outil pertinent n'est activé.
 */
export function pickLocalTool(
  role: AgentRole,
  latest: string,
  history: ChatMessage[],
  enabled: string[],
): LocalToolPick | null {
  const has = (n: string) => enabled.includes(n);
  const u = latest.toLowerCase();

  if (role === "appointment") {
    if (has("cancelAppointment") && /annul|supprim|décommand/.test(u))
      return {
        name: "cancelAppointment",
        args: { name: extractName(history) ?? "" },
        reply: "C'est annulé, je m'en occupe. Souhaitez-vous reprogrammer un autre créneau ?",
      };
    if (
      has("bookAppointment") &&
      /\b(oui|confirm|valid|parfait|c'est bon|d'accord|ça marche|je prends|réserv)\b/.test(u)
    )
      return {
        name: "bookAppointment",
        args: {
          name: extractName(history) ?? "Client",
          date: "2026-06-10",
          time: "09:30",
        },
        reply:
          "C'est enregistré, votre rendez-vous est confirmé. Vous recevrez un rappel par message. Puis-je faire autre chose ?",
      };
    if (has("checkAvailability") && /\b(dispo|créneau|libre|quand|horaire|disponibilit)\b/.test(u))
      return { name: "checkAvailability", args: { date: "2026-06-10" } };
  }

  if (role === "support") {
    const order = extractOrderId(latest);
    if (has("lookupOrder") && order)
      return {
        name: "lookupOrder",
        args: { orderId: order },
        reply: `Je vois votre commande ${order} : elle est expédiée et arrive sous deux jours ouvrés. Autre chose ?`,
      };
    if (has("createTicket") && /\b(rembours|cassé|défect|réclam|persiste|toujours pas|bloqué)\b/.test(u))
      return {
        name: "createTicket",
        args: { subject: latest.slice(0, 60), priority: "normale" },
        reply: "J'ai ouvert un ticket pour votre demande, notre équipe revient vers vous très vite.",
      };
  }

  if (role === "lead_qualification") {
    if (has("scoreLead") && /\b(budget|euros?|€|par mois|mensuel|k€|\d{3,})\b/.test(u))
      return {
        name: "scoreLead",
        args: { need: firstUser(history) ?? latest, budget: latest },
      };
    if (has("saveToCRM") && extractName(history))
      return {
        name: "saveToCRM",
        args: {
          name: extractName(history)!,
          email: extractEmail(history),
          phone: extractPhone(history),
          notes: firstUser(history),
        },
        reply: "C'est noté dans notre système, un conseiller vous recontacte très vite.",
      };
  }

  if (role === "outbound_sales") {
    if (has("scheduleCallback") && /\b(rappel|plus tard|occupé|pas le temps|autre moment|rappelez)\b/.test(u))
      return {
        name: "scheduleCallback",
        args: { when: latest, phone: extractPhone(history) },
        reply: "Parfait, je planifie un rappel à ce moment-là. Excellente journée !",
      };
    if (has("markInterested") && /\b(intéress|ça m'intéresse|pourquoi pas|essai|d'accord|allons-y)\b/.test(u))
      return { name: "markInterested", args: { level: "fort" } };
  }

  if (role === "receptionist") {
    if (has("takeMessage") && /\b(message|absent|indispo|laisser|transmett|rappeler)\b/.test(u))
      return {
        name: "takeMessage",
        args: { name: extractName(history) ?? "Appelant", phone: extractPhone(history), message: latest },
        reply: "C'est noté, je transmets votre message. Puis-je faire autre chose ?",
      };
    if (has("transferToHuman") && /\b(commercial|vente|support|technique|comptab|factur|service|parler à)\b/.test(u))
      return {
        name: "transferToHuman",
        args: { reason: latest, department: detectDept(u) },
        reply: "Je vous mets en relation avec le bon service, ne quittez pas.",
      };
  }

  if (role === "survey") {
    if (has("recordAnswer") && /[0-9]|bien|mauvais|satisfait|content|déçu|recommand/.test(u)) {
      const asked = history.filter((m) => m.role === "assistant").length;
      return {
        name: "recordAnswer",
        args: { questionId: `q${asked}`, answer: latest },
      };
    }
  }

  // Outil personnalisé : si une fonction sur-mesure est activée et que
  // l'appelant a fourni des informations, on la déclenche avec ce qu'on a.
  const custom = enabled.find((n) => !BUILTIN.has(n));
  if (custom && latest.trim().length > 8 && userTexts(history).length >= 2) {
    return {
      name: custom,
      args: {
        nom: extractName(history),
        email: extractEmail(history),
        telephone: extractPhone(history),
        message: latest,
      },
    };
  }

  return null;
}
