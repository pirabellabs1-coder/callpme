import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAccessEmail, expiredEmail, expiryReminderEmail, paymentReceiptEmail } from "@/lib/email/templates";

describe("e-mails de paiement", () => {
  it("le reçu donne le montant en euros, la facture et son lien, sans balise injectée", () => {
    const m = paymentReceiptEmail({
      name: "<b>Koffi</b>",
      orgName: "Clinique & Co",
      label: "Offre Starter · 30 jours",
      amountEur: 49,
      invoiceNumber: "FAC-2026-000001",
      invoiceUrl: "https://callpme.com/facture/p1",
      paidAt: new Date("2026-11-06T21:18:00Z"),
      activeUntil: new Date("2026-12-06T21:18:00Z"),
    });
    expect(m.subject).toContain("FAC-2026-000001");
    expect(m.html).toContain("49");
    expect(m.html).toContain("€");
    expect(m.html).not.toMatch(/FCFA|XOF/);
    expect(m.html).toContain("https://callpme.com/facture/p1");
    expect(m.html).toContain("&lt;b&gt;Koffi&lt;/b&gt;");
    expect(m.html).toContain("Clinique &amp; Co");
    expect(m.text).toContain("6 décembre 2026");
  });

  it("rappels d'échéance et accès démo", () => {
    expect(expiryReminderEmail({ name: "A", planName: "Pro", endsAt: new Date("2026-12-06T12:00:00Z"), daysLeft: 3 }).subject).toContain("3 jours");
    expect(expiryReminderEmail({ name: "A", planName: "Pro", endsAt: new Date(), daysLeft: 1 }).subject).toContain("1 jour");
    expect(expiredEmail({ name: "A", planName: "Pro" }).text).toContain("conservés");
    expect(demoAccessEmail({ name: "A", endsAt: new Date(), minutes: 30 }).html).toContain("30 minutes");
  });
});

const db = vi.hoisted(() => ({
  orgs: [] as { id: string; plan: string; paidUntil: Date | null; expiryReminderFor: Date | null; expiredNoticeFor: Date | null }[],
  sent: [] as string[],
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    organization: {
      findMany: async ({ where }: { where: { paidUntil: { gt?: Date; lte?: Date } } }) =>
        db.orgs.filter((o) => o.paidUntil && (!where.paidUntil.gt || o.paidUntil > where.paidUntil.gt) && (!where.paidUntil.lte || o.paidUntil <= where.paidUntil.lte)),
      updateMany: async ({ where, data }: { where: { id: string }; data: Record<string, Date> }) => {
        const o = db.orgs.find((x) => x.id === where.id)!;
        const [k, v] = Object.entries(data)[0];
        if ((o as Record<string, unknown>)[k] instanceof Date && ((o as Record<string, unknown>)[k] as Date).getTime() === v.getTime()) return { count: 0 };
        (o as Record<string, unknown>)[k] = v;
        return { count: 1 };
      },
    },
    user: { findMany: async () => [{ email: "chef@exemple.bj", name: "Chef" }] },
  },
}));
vi.mock("@/lib/email/resend", () => ({
  hasResend: () => true,
  sendEmail: async (o: { subject: string }) => {
    db.sent.push(o.subject);
    return { ok: true };
  },
}));

describe("rappels d'échéance (tâche quotidienne)", () => {
  afterEach(() => {
    db.orgs = [];
    db.sent = [];
  });

  it("prévient 3 jours avant puis à l'échéance, une seule fois par échéance", async () => {
    const { sendExpiryReminders } = await import("@/lib/billing/reminders");
    const now = new Date("2026-12-04T08:00:00Z");
    db.orgs = [
      { id: "bientot", plan: "starter", paidUntil: new Date("2026-12-06T21:18:00Z"), expiryReminderFor: null, expiredNoticeFor: null },
      { id: "fini", plan: "pro", paidUntil: new Date("2026-12-03T10:00:00Z"), expiryReminderFor: null, expiredNoticeFor: null },
      { id: "loin", plan: "pro", paidUntil: new Date("2026-12-30T10:00:00Z"), expiryReminderFor: null, expiredNoticeFor: null },
    ];
    expect(await sendExpiryReminders(now)).toEqual({ reminders: 1, expired: 1 });
    expect(db.sent).toHaveLength(2);
    expect(await sendExpiryReminders(now)).toEqual({ reminders: 0, expired: 0 }); // tâche relancée : rien en double
  });
});
