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

export const alertSettingsSchema = z.object({
  email: z.boolean(),
  events: z.array(z.enum(["lead", "appointment", "transfer", "call"])).max(4),
  /** Destinataires ; vide = propriétaire et administrateurs de l'organisation. */
  recipients: z.array(z.string().trim().toLowerCase().email()).max(5),
});
export type AlertSettings = z.infer<typeof alertSettingsSchema>;

export const DEFAULT_ALERTS: AlertSettings = { email: true, events: ["lead", "appointment", "transfer"], recipients: [] };

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
