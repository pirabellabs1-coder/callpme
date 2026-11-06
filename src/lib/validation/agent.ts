import { checkDestination } from "../telephony/destinations";
import { flowSchema } from "../flow/flow";
/**
 * Schémas de validation Zod pour l'API agents.
 * Les types métier (`@/lib/shared/types`) restent la source de vérité ;
 * Zod ne fait que valider la forme des requêtes entrantes.
 */
import { z } from "zod";

export const voiceSchema = z.object({
  provider: z.enum(["elevenlabs", "azure", "playht"]),
  voiceId: z.string().max(120),
  language: z.string().min(2).max(12),
  speed: z.number().min(0.5).max(2),
  // Champs optionnels conservés (sinon supprimés par zod). L'audio d'une voix Studio
  // n'est PAS copié dans l'agent : il est relu depuis la table Voice par son id.
  kind: z.enum(["preset", "custom", "provider"]).optional(),
  voiceLabel: z.string().max(120).optional(),
});

export const modelSchema = z.object({
  provider: z.enum(["openai", "anthropic", "mistral"]),
  modelId: z.string().min(1).max(80),
  temperature: z.number().min(0).max(1),
});

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure HH:MM");
export const bookingSchema = z.object({
  timezone: z
    .string()
    .max(60)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Fuseau horaire inconnu"),
  durationMin: z.number().int().min(5).max(480),
  hours: z.partialRecord(
    z.enum(["0", "1", "2", "3", "4", "5", "6"]),
    z.array(z.tuple([hm, hm]).refine(([a, b]) => a < b, "Plage horaire invalide")).max(4),
  ),
  minNoticeMin: z.number().int().min(0).max(10080),
  maxDaysAhead: z.number().int().min(1).max(365),
  smsConfirmation: z.boolean(),
});

export const configSchema = z.object({
  voice: voiceSchema,
  model: modelSchema,
  systemPrompt: z.string().max(20000),
  firstMessage: z.string().max(2000),
  firstSpeaker: z.enum(["agent", "caller"]),
  guardrails: z.array(z.string().max(500)).max(30),
  tools: z.array(z.string().max(80)).max(60),
  persona: z.string().max(1000).optional(),
  // Tolérant à toute forme (null, undefined, champ manquant, anciens clients…) :
  // n'importe quelle valeur est ramenée à du texte → jamais d'« Invalid input ».
  customRole: z
    .any()
    .transform((v): { label: string; description: string } | undefined => {
      if (!v || typeof v !== "object") return undefined;
      const label = typeof v.label === "string" ? v.label.slice(0, 80) : "";
      const description =
        typeof v.description === "string" ? v.description.slice(0, 2000) : "";
      return { label, description };
    })
    .optional(),
  maxDurationSec: z.number().min(0).max(7200).optional(),
  // Numéro de transfert vers un humain (format international), vide = aucun.
  transferNumber: z
    .string()
    .trim()
    .regex(/^(\+\d[\d ]{7,18})?$/, "Numéro au format international, ex. +33 1 23 45 67 89")
    // Le transfert est payé par la plateforme : mêmes règles que les appels sortants.
    .refine((v) => !v || checkDestination(v).ok, "Destination non autorisée (pays non couvert ou numéro surtaxé).")
    .optional(),
  booking: bookingSchema.optional(),
  analysis: z
    .object({
      fields: z
        .array(
          z.object({
            key: z.string().regex(/^[a-z0-9_]{1,40}$/, "Clé invalide"),
            label: z.string().trim().min(1).max(80),
            type: z.enum(["text", "number", "boolean", "choice", "date"]),
            description: z.string().trim().max(300).optional(),
            options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
          }),
        )
        .max(15),
      successCriteria: z.string().trim().max(600).optional(),
    })
    .optional(),
  voicemail: z
    .object({
      action: z.enum(["message", "hangup", "off"]),
      message: z.string().trim().max(600).optional(),
    })
    .optional(),
  flow: flowSchema.optional(),
});

export const createAgentSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(80),
  role: z.enum([
    "support",
    "appointment",
    "lead_qualification",
    "outbound_sales",
    "receptionist",
    "survey",
    "custom",
  ]),
  status: z.enum(["active", "paused", "draft"]).optional(),
  config: configSchema,
  phoneNumber: z.string().max(40).nullable().optional(),
  clientId: z.string().max(60).nullable().optional(),
  knowledgeBaseId: z.string().max(60).nullable().optional(),
});

export const updateAgentSchema = createAgentSchema.partial();

export const assignNumberSchema = z.object({
  phoneNumber: z.string().max(40).nullable(),
});
