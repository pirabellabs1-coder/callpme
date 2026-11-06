/**
 * Rappels d'échéance par e-mail (tâche quotidienne) : 3 jours avant la fin
 * de la période payée, puis le jour où l'offre arrive à échéance. Un seul
 * envoi par échéance (paidUntil mémorisé), même si la tâche tourne plusieurs fois.
 */
import { prisma } from "../db/client";
import { getPlan } from "./plans";
import { hasResend, sendEmail } from "../email/resend";
import { expiredEmail, expiryReminderEmail } from "../email/templates";
import { billingRecipients } from "../payments/notify";

const DAY = 86_400_000;

export async function sendExpiryReminders(now = new Date()): Promise<{ reminders: number; expired: number }> {
  if (!hasResend()) return { reminders: 0, expired: 0 };
  let reminders = 0;
  let expired = 0;

  const soon = await prisma.organization.findMany({
    where: { paidUntil: { gt: now, lte: new Date(now.getTime() + 3 * DAY) } },
    select: { id: true, plan: true, paidUntil: true, expiryReminderFor: true },
  });
  for (const o of soon) {
    if (!o.paidUntil || o.expiryReminderFor?.getTime() === o.paidUntil.getTime()) continue;
    // Réservation de l'envoi (évite un double envoi si deux tâches tournent en même temps).
    const claimed = await prisma.organization.updateMany({
      where: { id: o.id, paidUntil: o.paidUntil, OR: [{ expiryReminderFor: null }, { expiryReminderFor: { not: o.paidUntil } }] },
      data: { expiryReminderFor: o.paidUntil },
    });
    if (claimed.count !== 1) continue;
    const daysLeft = Math.max(1, Math.ceil((o.paidUntil.getTime() - now.getTime()) / DAY));
    const to = await billingRecipients(o.id);
    await Promise.allSettled(
      to.map((u) => {
        const m = expiryReminderEmail({ name: u.name ?? "", planName: getPlan(o.plan).name, endsAt: o.paidUntil!, daysLeft });
        return sendEmail({ to: u.email, subject: m.subject, html: m.html, text: m.text });
      }),
    );
    reminders++;
  }

  const ended = await prisma.organization.findMany({
    where: { paidUntil: { lte: now, gt: new Date(now.getTime() - 7 * DAY) } },
    select: { id: true, plan: true, paidUntil: true, expiredNoticeFor: true },
  });
  for (const o of ended) {
    if (!o.paidUntil || o.expiredNoticeFor?.getTime() === o.paidUntil.getTime()) continue;
    const claimed = await prisma.organization.updateMany({
      where: { id: o.id, paidUntil: o.paidUntil, OR: [{ expiredNoticeFor: null }, { expiredNoticeFor: { not: o.paidUntil } }] },
      data: { expiredNoticeFor: o.paidUntil },
    });
    if (claimed.count !== 1) continue;
    const to = await billingRecipients(o.id);
    await Promise.allSettled(
      to.map((u) => {
        const m = expiredEmail({ name: u.name ?? "", planName: getPlan(o.plan).name });
        return sendEmail({ to: u.email, subject: m.subject, html: m.html, text: m.text });
      }),
    );
    expired++;
  }
  return { reminders, expired };
}
