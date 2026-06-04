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
});

export const modelSchema = z.object({
  provider: z.enum(["openai", "anthropic", "mistral"]),
  modelId: z.string().min(1).max(80),
  temperature: z.number().min(0).max(1),
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
