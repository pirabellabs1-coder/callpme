/**
 * Plafonds quotidiens par organisation, stockés en base (valables quel que
 * soit le nombre d'instances) : SMS et e-mails déclenchés par les agents.
 */
import { prisma } from "../db/client";

export const DAILY_LIMITS = { sms: 200, email: 100, number: 10, invite: 30, widget: 500, apicall: 300, whatsapp: 2000, whatsapp_voice: 300, whatsapp_tts: 300 } as const;
export type DailyKind = keyof typeof DAILY_LIMITS;

/** Réserve une unité ; false si le plafond du jour est atteint. */
export async function takeDailyQuota(organizationId: string, kind: DailyKind): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const row = await prisma.dailyCounter.upsert({
    where: { organizationId_day_kind: { organizationId, day, kind } },
    create: { organizationId, day, kind, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count <= DAILY_LIMITS[kind];
}

/** Texte envoyé par un agent : pas de lien ni de domaine (anti-hameçonnage). */
export function containsLink(text: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|fr|net|org|io|co|app|link|ly|info|biz|xyz|me|site|online|click|top|shop|store|be|ch|ca|ci|sn|cm|bj|tg|ml)\b)/i.test(
    text,
  );
}

/** Somme d'un compteur sur les N derniers jours (ex. numéros achetés sur 30 jours). */
export async function countSince(organizationId: string, kind: DailyKind, days: number): Promise<number> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const agg = await prisma.dailyCounter.aggregate({
    where: { organizationId, kind, day: { gte: from } },
    _sum: { count: true },
  });
  return agg._sum.count ?? 0;
}
