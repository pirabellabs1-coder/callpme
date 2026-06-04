/**
 * Catalogue d'événements webhook — module de données pur (importable côté
 * client). Le dispatcher (`dispatch.ts`, serveur) le réexporte.
 */
export type WebhookEvent =
  | "agent.created"
  | "agent.updated"
  | "agent.deleted"
  | "call.completed"
  | "call.transferred"
  | "ping";

export const WEBHOOK_EVENTS: { id: WebhookEvent; label: string }[] = [
  { id: "agent.created", label: "Agent créé" },
  { id: "agent.updated", label: "Agent modifié" },
  { id: "agent.deleted", label: "Agent supprimé" },
  { id: "call.completed", label: "Appel terminé" },
  { id: "call.transferred", label: "Appel transféré" },
];
