/**
 * Résumé quotidien au gérant : chaque soir (heure et fuseau réglables par
 * organisation), un point sur la journée — appels reçus et manqués, appelants
 * rappelés, rendez-vous, fiches clients, urgences à rappeler.
 *
 * - Envoi par WhatsApp (modèle approuvé par Meta) si le canal est configuré,
 *   sinon — ou en cas d'échec — par e-mail.
 * - Une fois par jour local et par organisation : verrou en base
 *   (DailyCounter, kind « digest », jour local), valable quel que soit le
 *   nombre d'instances qui font le tour.
 * - Rien n'est envoyé si la journée est vide (on revérifie au tour suivant,
 *   dans la fenêtre de rattrapage).
 *
 * `tickDigests` est appelé par le serveur vocal (toutes les 5 min) et par les
 * routes de cron ; il ne fait rien hors de l'heure de chaque organisation.
 */
import { prisma } from "../db/client";
import { parseAlertSettings, type DigestSettings } from "../alerts/settings";
import { decryptSecret } from "../crypto/secrets";
import { sendEmail } from "../email/resend";
import { getCountry } from "../geo/countries";
import { takeDailyQuota } from "../security/daily-quota";
import { sendWhatsAppTemplate } from "../whatsapp/cloud";
import { isDigestDue, localParts, startOfLocalDay } from "./schedule";
import { buildDigest, hasActivity, MAX_URGENT_LISTED, type DigestData, type DigestUrgent } from "./summary";

export const DIGEST_KIND = "digest";
const FALLBACK_TZ = "Africa/Porto-Novo";

export function digestTimeZone(settings: DigestSettings, country: string | null | undefined): string {
  return settings.timeZone || (country ? getCountry(country).timezone : "") || FALLBACK_TZ;
}

/** Déjà envoyé (ou en cours d'envoi) pour ce jour local ? */
export async function digestAlreadySent(organizationId: string, day: string): Promise<boolean> {
  const row = await prisma.dailyCounter.findUnique({
    where: { organizationId_day_kind: { organizationId, day, kind: DIGEST_KIND } },
    select: { id: true },
  });
  return Boolean(row);
}

/** Prend le verrou du jour ; false si une autre instance l'a déjà pris. */
export async function claimDigest(organizationId: string, day: string): Promise<boolean> {
  try {
    await prisma.dailyCounter.create({ data: { organizationId, day, kind: DIGEST_KIND, count: 1 } });
    return true;
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return false;
    throw e;
  }
}

const CALLBACK_UNREACHED = ["no_answer", "failed", "expired"];

export async function collectDigestData(org: { id: string; name: string }, day: string, from: Date, to: Date): Promise<DigestData> {
  const range = { gte: from, lt: to };
  const orgCalls = { agent: { organizationId: org.id }, createdAt: range };
  const [received, missed, outbound, cbCompleted, cbUnreached, appointments, leads, unreachedRows, urgentLeads] = await Promise.all([
    prisma.call.count({ where: { ...orgCalls, direction: "inbound" } }),
    prisma.call.count({ where: { ...orgCalls, direction: "inbound", status: "missed" } }),
    prisma.call.count({ where: { ...orgCalls, direction: "outbound" } }),
    prisma.callback.count({ where: { organizationId: org.id, createdAt: range, status: "completed" } }),
    prisma.callback.count({ where: { organizationId: org.id, createdAt: range, status: { in: CALLBACK_UNREACHED } } }),
    prisma.appointment.count({ where: { organizationId: org.id, createdAt: range, status: "booked", isTest: false } }),
    prisma.lead.count({ where: { organizationId: org.id, createdAt: range, isTest: false } }),
    prisma.callback.findMany({
      where: { organizationId: org.id, createdAt: range, status: { in: CALLBACK_UNREACHED } },
      select: { phone: true, reason: true, callId: true },
      orderBy: { createdAt: "asc" },
      take: MAX_URGENT_LISTED + 1,
    }),
    prisma.lead.findMany({
      where: { organizationId: org.id, createdAt: range, isTest: false, status: "new", kind: { in: ["callback", "ticket"] } },
      select: { name: true, phone: true, kind: true },
      orderBy: { createdAt: "asc" },
      take: MAX_URGENT_LISTED + 1,
    }),
  ]);

  const urgent: DigestUrgent[] = [
    ...urgentLeads.map((l) => ({
      label: `${l.kind === "ticket" ? "Signalement" : "Rappel demandé"} — ${l.name}`,
      phone: l.phone,
      href: "/leads",
    })),
    ...unreachedRows.map((c) => ({
      label: c.reason === "flash" ? "Bip, rappel sans réponse" : "Appel manqué, rappel sans réponse",
      phone: c.phone,
      href: c.callId ? `/calls/${encodeURIComponent(c.callId)}` : "/calls",
    })),
  ];

  return {
    orgName: org.name,
    day,
    calls: { received, missed, outbound },
    callbacks: { completed: cbCompleted, unreached: cbUnreached },
    appointments,
    leads,
    urgent,
  };
}

async function ownerEmails(organizationId: string, recipients: string[]): Promise<string[]> {
  if (recipients.length) return recipients;
  const users = await prisma.user.findMany({
    where: { organizationId, role: { in: ["owner", "admin"] } },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

export type DigestOutcome = "whatsapp" | "email" | "empty" | "already_sent" | "not_due" | "disabled" | "failed";

interface OrgRow {
  id: string;
  name: string;
  alerts: string | null;
  country: string | null;
  whatsapp: { phoneNumberId: string; accessToken: string; enabled: boolean } | null;
}

export async function sendDailyDigest(org: OrgRow, now = new Date()): Promise<DigestOutcome> {
  const settings = parseAlertSettings(org.alerts);
  const d = settings.digest;
  if (!d.enabled) return "disabled";
  const tz = digestTimeZone(d, org.country);
  if (!isDigestDue(now, d.hour, tz)) return "not_due";
  const { day } = localParts(now, tz);
  if (await digestAlreadySent(org.id, day)) return "already_sent";

  const data = await collectDigestData(org, day, startOfLocalDay(now, tz), now);
  if (!hasActivity(data)) return "empty";
  if (!(await claimDigest(org.id, day))) return "already_sent";

  const built = buildDigest(data, process.env.PUBLIC_URL || "http://localhost:3000");

  // 1. WhatsApp : canal actif, modèle approuvé et numéro(s) du gérant renseignés.
  const wa = org.whatsapp;
  if (wa?.enabled && d.whatsappTemplate && d.whatsappTo.length) {
    const token = decryptSecret(wa.accessToken);
    if (token) {
      let sent = 0;
      for (const to of d.whatsappTo) {
        if (!(await takeDailyQuota(org.id, "whatsapp"))) break;
        const ok = await sendWhatsAppTemplate(wa.phoneNumberId, token, to, {
          name: d.whatsappTemplate,
          language: d.whatsappLanguage,
          params: [built.whatsappParam],
        });
        if (ok) sent++;
      }
      if (sent) return "whatsapp";
    }
  }

  // 2. Repli e-mail (ou canal unique si WhatsApp n'est pas configuré).
  const to = await ownerEmails(org.id, settings.recipients);
  if (!to.length || !(await takeDailyQuota(org.id, "email"))) return "failed";
  const r = await sendEmail({ to, subject: built.subject, html: built.html, text: built.text }).catch(() => null);
  // Pas de nouvel essai en cas d'échec : mieux vaut un résumé manqué que des doublons.
  return r?.ok ? "email" : "failed";
}

export interface DigestTickReport {
  checked: number;
  whatsapp: number;
  email: number;
  failed: number;
}

/** Un tour : envoie le résumé aux organisations dont c'est l'heure. */
export async function tickDigests(now = new Date()): Promise<DigestTickReport> {
  const report: DigestTickReport = { checked: 0, whatsapp: 0, email: 0, failed: 0 };
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      alerts: true,
      country: true,
      whatsapp: { select: { phoneNumberId: true, accessToken: true, enabled: true } },
    },
  });
  for (const org of orgs) {
    report.checked++;
    try {
      const outcome = await sendDailyDigest(org, now);
      if (outcome === "whatsapp" || outcome === "email" || outcome === "failed") report[outcome]++;
    } catch (e) {
      report.failed++;
      console.error("[digest]", org.id, e instanceof Error ? e.message : e);
    }
  }
  return report;
}
