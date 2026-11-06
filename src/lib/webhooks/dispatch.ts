/**
 * Diffusion de webhooks — livraison HTTP réelle, signée HMAC-SHA256.
 * Les consommateurs vérifient l'en-tête `X-Callpme-Signature`.
 */
import { createHmac } from "crypto";
import { publicRequest } from "@/lib/net/safe-fetch";
import { prisma } from "@/lib/db/client";
import { WEBHOOK_EVENTS, type WebhookEvent } from "./events";
import { notifyIntegrations } from "@/lib/integrations/automations";

export { WEBHOOK_EVENTS };
export type { WebhookEvent };

export function signPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

interface Deliverable {
  id: string;
  url: string;
  secret: string;
}

/** Livre un événement à un endpoint et journalise le statut. */
export async function deliver(
  webhook: Deliverable,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<number | null> {
  const body = JSON.stringify({
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });
  const signature = signPayload(webhook.secret, body);

  try {
    // Requête protégée SSRF (IP vérifiée à la connexion, pas de redirection).
    const res = await publicRequest(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Callpme-Event": event,
        "X-Callpme-Signature": signature,
        "User-Agent": "Callpme-Webhooks/1.0",
      },
      body,
      timeoutMs: 5000,
    });
    await prisma.webhook
      .update({
        where: { id: webhook.id },
        data: { lastStatus: res.status, lastDeliveryAt: new Date() },
      })
      .catch(() => {});
    return res.status;
  } catch {
    await prisma.webhook
      .update({
        where: { id: webhook.id },
        data: { lastStatus: 0, lastDeliveryAt: new Date() },
      })
      .catch(() => {});
    return null;
  }
}

/** Diffuse un événement à tous les webhooks abonnés de l'organisation. */
export async function dispatchEvent(
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const hooks = await prisma.webhook.findMany({
    where: { organizationId: orgId, enabled: true },
  });
  const matching = hooks.filter((h) => {
    try {
      return (JSON.parse(h.events) as string[]).includes(event);
    } catch {
      return false;
    }
  });
  await Promise.allSettled([
    ...matching.map((h) => deliver({ id: h.id, url: h.url, secret: h.secret }, event, payload)),
    // Slack, Zapier / Make / n8n : alertes et automatisations de l'organisation.
    notifyIntegrations(orgId, event, payload),
  ]);
}
