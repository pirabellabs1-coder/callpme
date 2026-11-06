/**
 * Alertes au propriétaire : un e-mail quand il se passe quelque chose
 * d'important (message laissé, rappel demandé, rendez-vous pris, appel
 * transféré, appel manqué). Réglables par organisation dans Réglages.
 */
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/resend";
import { emailLayout, escapeHtml } from "@/lib/email/templates";
import { takeDailyQuota } from "@/lib/security/daily-quota";
import type { WebhookEvent } from "@/lib/webhooks/events";
import { alertIdFor, parseAlertSettings, type AlertEventId } from "./settings";

export * from "./settings";

const LINKS: Record<AlertEventId, string> = { lead: "/leads", appointment: "/appointments", transfer: "/calls", call: "/calls" };

export async function sendOwnerAlert(orgId: string, event: WebhookEvent, text: string): Promise<void> {
  const id = alertIdFor(event);
  if (!id) return;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, alerts: true } });
  if (!org) return;
  const settings = parseAlertSettings(org.alerts);
  if (!settings.email || !settings.events.includes(id)) return;
  const to = settings.recipients.length
    ? settings.recipients
    : (
        await prisma.user.findMany({
          where: { organizationId: orgId, role: { in: ["owner", "admin"] } },
          select: { email: true },
        })
      ).map((u) => u.email);
  if (!to.length || !(await takeDailyQuota(orgId, "email"))) return;

  const [title, ...rest] = text.split("\n");
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  const html = emailLayout({
    preheader: title,
    heading: escapeHtml(title),
    bodyHtml: rest.length ? `<p style="margin:0;">${escapeHtml(rest.join("\n")).replace(/\n/g, "<br/>")}</p>` : "",
    ctaLabel: "Ouvrir dans Callpme",
    ctaUrl: `${base}${LINKS[id]}`,
    footnote: `Alerte de l'espace ${escapeHtml(org.name)}. Réglez vos alertes dans Réglages › Alertes.`,
  });
  await sendEmail({ to, subject: `Callpme · ${title.replace(/[\r\n]+/g, " ").slice(0, 120)}`, html, text }).catch(() => null);
}
