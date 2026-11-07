/** Réglages des alertes au propriétaire (module pur, utilisable côté client). */
import { z } from "zod";
import type { WebhookEvent } from "@/lib/webhooks/events";

export const ALERT_EVENTS = [
  { id: "lead", label: "Prospect, message ou rappel demandé", events: ["lead.created"] },
  { id: "appointment", label: "Rendez-vous pris ou annulé", events: ["appointment.booked", "appointment.cancelled"] },
  { id: "transfer", label: "Appel transféré à un conseiller", events: ["call.transferred"] },
  { id: "call", label: "Chaque appel terminé (résumé)", events: ["call.completed"] },
] as const;
export type AlertEventId = (typeof ALERT_EVENTS)[number]["id"];

/** Fuseau IANA reconnu par le moteur (ex. Africa/Porto-Novo). */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(tz) || tz === "UTC";
  } catch {
    return false;
  }
}

/** Résumé quotidien envoyé au gérant (WhatsApp si possible, sinon e-mail). */
export const digestSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Heure locale d'envoi (0–23). */
  hour: z.number().int().min(0).max(23),
  /** Fuseau IANA ; vide = celui du pays de l'organisation. */
  timeZone: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === "" || isValidTimeZone(v), "Fuseau horaire inconnu."),
  /** Numéros WhatsApp du gérant (format international, ex. +2290197123456). */
  whatsappTo: z
    .array(z.string().trim().regex(/^\+\d{8,15}$/, "Numéro WhatsApp au format international (+229…)."))
    .max(3),
  /** Nom du modèle de message approuvé par Meta (un seul paramètre {{1}} dans le corps). */
  whatsappTemplate: z
    .string()
    .trim()
    .max(512)
    .regex(/^[a-z0-9_]*$/, "Nom de modèle : minuscules, chiffres et « _ » uniquement."),
  /** Langue du modèle chez Meta (ex. fr, fr_FR, en_US). */
  whatsappLanguage: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Langue du modèle invalide (ex. fr)."),
});
export type DigestSettings = z.infer<typeof digestSettingsSchema>;

export const DEFAULT_DIGEST: DigestSettings = {
  enabled: true,
  hour: 19,
  timeZone: "",
  whatsappTo: [],
  whatsappTemplate: "",
  whatsappLanguage: "fr",
};

export const alertSettingsSchema = z.object({
  email: z.boolean(),
  events: z.array(z.enum(["lead", "appointment", "transfer", "call"])).max(4),
  /** Destinataires ; vide = propriétaire et administrateurs de l'organisation. */
  recipients: z.array(z.string().trim().toLowerCase().email()).max(5),
  /** Absent dans les réglages enregistrés avant le résumé quotidien : valeurs par défaut. */
  digest: digestSettingsSchema.default(DEFAULT_DIGEST),
});
export type AlertSettings = z.infer<typeof alertSettingsSchema>;

export const DEFAULT_ALERTS: AlertSettings = {
  email: true,
  events: ["lead", "appointment", "transfer"],
  recipients: [],
  digest: DEFAULT_DIGEST,
};

export function parseAlertSettings(raw: string | null | undefined): AlertSettings {
  try {
    const r = alertSettingsSchema.safeParse(raw ? JSON.parse(raw) : null);
    return r.success ? r.data : DEFAULT_ALERTS;
  } catch {
    return DEFAULT_ALERTS;
  }
}

/** Quel réglage couvre cet événement ? */
export function alertIdFor(event: WebhookEvent): AlertEventId | null {
  return ALERT_EVENTS.find((a) => (a.events as readonly string[]).includes(event))?.id ?? null;
}
