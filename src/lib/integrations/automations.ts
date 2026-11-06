/**
 * Intégrations « événements » : Slack (alertes dans un canal) et Zapier /
 * Make / n8n (déclencheurs d'automatisation). Appelé à chaque événement de
 * l'organisation, en plus des webhooks développeur. Best-effort : un échec
 * n'interrompt jamais l'appel ou l'action d'origine.
 */
import { publicRequest } from "@/lib/net/safe-fetch";
import { integrationCredentials } from "./credentials";
import type { WebhookEvent } from "@/lib/webhooks/events";

/** Événements utiles au métier (les changements d'agents ne sont pas relayés). */
const RELAYED: WebhookEvent[] = ["call.completed", "call.transferred", "lead.created", "appointment.booked", "appointment.cancelled"];

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Texte lisible d'un événement (Slack, e-mail, WhatsApp…). */
export function describeEvent(event: WebhookEvent, d: Record<string, unknown>): string {
  switch (event) {
    case "call.completed":
    case "call.transferred": {
      const min = Math.max(1, Math.round(Number(d.durationSec ?? 0) / 60));
      const head = event === "call.transferred" ? "Appel transféré" : "Appel terminé";
      return `${head} · ${str(d.agentName)} · ${min} min · ${str(d.outcome)}\n${str(d.summary)}`.trim();
    }
    case "lead.created":
      return `Nouveau ${d.kind === "message" ? "message" : d.kind === "callback" ? "rappel demandé" : "prospect"} : ${str(d.name)} ${str(d.phone)}\n${str(d.notes)}`.trim();
    case "appointment.booked": {
      const when = d.startsAt ? new Date(str(d.startsAt)).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) : "";
      return `Rendez-vous pris : ${str(d.customerName)} ${str(d.customerPhone)} · ${when} (réf. ${str(d.reference)})`;
    }
    case "appointment.cancelled":
      return `Rendez-vous annulé : réf. ${str(d.reference)}`;
    default:
      return event;
  }
}

export function isSlackWebhook(url: string): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/.test(url);
}

export async function notifyIntegrations(orgId: string, event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  if (!RELAYED.includes(event)) return;
  const [slack, automation] = await Promise.all([
    integrationCredentials(orgId, "slack").catch(() => null),
    integrationCredentials(orgId, "zapier").catch(() => null),
  ]);
  const jobs: Promise<unknown>[] = [];
  if (slack?.webhook_url && isSlackWebhook(slack.webhook_url)) {
    jobs.push(
      publicRequest(slack.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: describeEvent(event, payload) }),
        timeoutMs: 5000,
      }),
    );
  }
  if (automation?.webhook_url?.startsWith("https://")) {
    jobs.push(
      publicRequest(automation.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Callpme-Automations/1.0" },
        body: JSON.stringify({ event, summary: describeEvent(event, payload), data: payload, timestamp: new Date().toISOString() }),
        timeoutMs: 5000,
      }),
    );
  }
  await Promise.allSettled(jobs);
}
