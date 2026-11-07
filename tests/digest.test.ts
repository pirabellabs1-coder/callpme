import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fausse base : compteurs du jour (verrou), appels, rappels, rendez-vous, fiches. */
const db = vi.hoisted(() => {
  const state = {
    counters: [] as { organizationId: string; day: string; kind: string }[],
    counts: { inbound: 0, missed: 0, outbound: 0, cbCompleted: 0, cbUnreached: 0, appointments: 0, leads: 0 },
    urgentLeads: [] as { name: string; phone: string | null; kind: string }[],
    unreached: [] as { phone: string; reason: string; callId: string | null }[],
    users: [{ email: "gerant@exemple.bj" }],
  };
  const key = (w: { organizationId: string; day: string; kind: string }) => `${w.organizationId}|${w.day}|${w.kind}`;
  const prisma = {
    dailyCounter: {
      findUnique: async ({ where }: { where: { organizationId_day_kind: { organizationId: string; day: string; kind: string } } }) =>
        state.counters.find((c) => key(c) === key(where.organizationId_day_kind)) ?? null,
      create: async ({ data }: { data: { organizationId: string; day: string; kind: string } }) => {
        if (state.counters.some((c) => key(c) === key(data))) throw Object.assign(new Error("unique"), { code: "P2002" });
        state.counters.push(data);
        return data;
      },
      upsert: async () => ({ count: 1 }),
    },
    call: {
      count: async ({ where }: { where: { direction: string; status?: string } }) =>
        where.direction === "outbound" ? state.counts.outbound : where.status === "missed" ? state.counts.missed : state.counts.inbound,
    },
    callback: {
      count: async ({ where }: { where: { status: unknown } }) =>
        where.status === "completed" ? state.counts.cbCompleted : state.counts.cbUnreached,
      findMany: async () => state.unreached,
    },
    appointment: { count: async () => state.counts.appointments },
    lead: { count: async () => state.counts.leads, findMany: async () => state.urgentLeads },
    user: { findMany: async () => state.users },
    organization: { findMany: async () => [] },
  };
  return { state, prisma };
});
const sendEmail = vi.hoisted(() => vi.fn(async (_opts: { to: string[]; subject: string }) => ({ ok: true })));
const sendTemplate = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => true));
vi.mock("@/lib/db/client", () => ({ prisma: db.prisma }));
vi.mock("@/lib/email/resend", () => ({ sendEmail }));
vi.mock("@/lib/whatsapp/cloud", () => ({ sendWhatsAppTemplate: sendTemplate }));
vi.mock("@/lib/crypto/secrets", () => ({
  decryptSecret: (v: string | null) => {
    if (v === "corrompu") throw new Error("Unsupported state or unable to authenticate data");
    return v;
  },
}));

import { DEFAULT_DIGEST, parseAlertSettings, splitPhones } from "@/lib/alerts/settings";
import { claimDigest, digestTimeZone, sendDailyDigest } from "@/lib/digest/digest";
import { isDigestDue, localParts, startOfLocalDay } from "@/lib/digest/schedule";
import { buildDigest, hasActivity, oneLine, type DigestData } from "@/lib/digest/summary";

const BENIN = "Africa/Porto-Novo"; // UTC+1, sans heure d'été

describe("résumé quotidien — heure d'envoi par fuseau", () => {
  it("19 h à Porto-Novo = 18 h UTC", () => {
    expect(isDigestDue(new Date("2026-11-07T17:59:00Z"), 19, BENIN)).toBe(false);
    expect(isDigestDue(new Date("2026-11-07T18:00:00Z"), 19, BENIN)).toBe(true);
    // Rattrapage limité à quelques heures, jamais le lendemain matin.
    expect(isDigestDue(new Date("2026-11-07T20:30:00Z"), 19, BENIN)).toBe(true);
    expect(isDigestDue(new Date("2026-11-07T21:00:00Z"), 19, BENIN)).toBe(false);
    expect(isDigestDue(new Date("2026-11-08T05:00:00Z"), 19, BENIN)).toBe(false);
  });

  it("même heure locale, instants différents selon le fuseau", () => {
    expect(isDigestDue(new Date("2026-11-07T19:00:00Z"), 19, "Africa/Dakar")).toBe(true); // UTC+0
    expect(isDigestDue(new Date("2026-11-07T18:00:00Z"), 19, "Africa/Dakar")).toBe(false);
    // Paris en été (UTC+2) puis en hiver (UTC+1).
    expect(isDigestDue(new Date("2026-07-01T17:00:00Z"), 19, "Europe/Paris")).toBe(true);
    expect(isDigestDue(new Date("2026-12-01T17:00:00Z"), 19, "Europe/Paris")).toBe(false);
  });

  it("minuit local les jours de changement d'heure (Paris)", () => {
    expect(startOfLocalDay(new Date("2026-03-29T18:00:00Z"), "Europe/Paris").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(startOfLocalDay(new Date("2026-10-25T18:00:00Z"), "Europe/Paris").toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("jour local et minuit local", () => {
    // 23 h 30 UTC le 7 = 00 h 30 le 8 à Porto-Novo.
    expect(localParts(new Date("2026-11-07T23:30:00Z"), BENIN)).toEqual({ day: "2026-11-08", hour: 0, minute: 30 });
    expect(startOfLocalDay(new Date("2026-11-07T18:00:00Z"), BENIN).toISOString()).toBe("2026-11-06T23:00:00.000Z");
    expect(startOfLocalDay(new Date("2026-07-01T17:00:00Z"), "Europe/Paris").toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("fuseau : réglage, sinon pays, sinon Porto-Novo", () => {
    expect(digestTimeZone({ ...DEFAULT_DIGEST, timeZone: "Africa/Lagos" }, "BJ")).toBe("Africa/Lagos");
    expect(digestTimeZone(DEFAULT_DIGEST, "SN")).toBe("Africa/Dakar");
    expect(digestTimeZone(DEFAULT_DIGEST, null)).toBe(BENIN);
  });
});

describe("résumé quotidien — réglages", () => {
  it("anciens réglages sans résumé : activé à 19 h par défaut", () => {
    const s = parseAlertSettings(JSON.stringify({ email: true, events: ["lead"], recipients: [] }));
    expect(s.digest).toEqual(DEFAULT_DIGEST);
    expect(s.digest.enabled).toBe(true);
    expect(s.digest.hour).toBe(19);
  });

  it("anciens réglages avec e-mails coupés : pas de résumé non plus", () => {
    expect(parseAlertSettings(JSON.stringify({ email: false, events: [], recipients: [] })).digest.enabled).toBe(false);
  });

  it("numéros WhatsApp saisis avec espaces, points ou 00", () => {
    expect(splitPhones("+229 01 97 12 34 56\n00229.01.96.00.00.00 ; +33 6 12 34 56 78")).toEqual([
      "+2290197123456",
      "+2290196000000",
      "+33612345678",
    ]);
  });

  it("heure d'envoi le soir uniquement (le résumé couvre minuit → l'heure d'envoi)", () => {
    const base = { email: true, events: [], recipients: [] };
    expect(parseAlertSettings(JSON.stringify({ ...base, digest: { ...DEFAULT_DIGEST, hour: 7 } })).events).toEqual(["lead", "appointment", "transfer"]);
    expect(parseAlertSettings(JSON.stringify({ ...base, digest: { ...DEFAULT_DIGEST, hour: 12 } })).digest.hour).toBe(12);
  });

  it("refuse un fuseau inconnu, une heure hors bornes ou un numéro sans indicatif", () => {
    const base = { email: true, events: [], recipients: [] };
    const bad = (digest: object) => parseAlertSettings(JSON.stringify({ ...base, digest: { ...DEFAULT_DIGEST, ...digest } })).events;
    expect(bad({ timeZone: "Mars/Olympus" })).toEqual(["lead", "appointment", "transfer"]); // retombe sur les défauts
    expect(bad({ hour: 24 })).toEqual(["lead", "appointment", "transfer"]);
    expect(bad({ whatsappTo: ["0197123456"] })).toEqual(["lead", "appointment", "transfer"]);
    expect(bad({ whatsappTemplate: "Résumé du soir" })).toEqual(["lead", "appointment", "transfer"]);
    expect(bad({ timeZone: "Africa/Lome", whatsappTo: ["+2290197123456"], whatsappTemplate: "resume_quotidien" })).toEqual([]);
  });
});

const sample = (over: Partial<DigestData> = {}): DigestData => ({
  orgName: "Pharmacie du Port",
  day: "2026-11-07",
  calls: { received: 12, missed: 3, outbound: 0 },
  callbacks: { completed: 2, unreached: 1 },
  appointments: 4,
  leads: 5,
  urgent: [
    { label: "Rappel demandé — Koffi A.", phone: "+2290197123456", href: "/leads" },
    { label: "Bip, rappel sans réponse", phone: "+2290196000000", href: "/calls/c_1" },
  ],
  ...over,
});

describe("résumé quotidien — contenu", () => {
  it("chiffres de la journée, urgences et liens vers le tableau de bord", () => {
    const b = buildDigest(sample(), "https://callpme.com/");
    expect(b.subject).toBe("Callpme · Résumé du samedi 7 novembre · 2 urgences");
    expect(b.text).toContain("12 appels reçus, dont 3 manqués");
    expect(b.text).toContain("2 appelants rappelés, 1 rappel sans réponse");
    expect(b.text).toContain("4 rendez-vous pris");
    expect(b.text).toContain("5 fiches clients créées");
    expect(b.text).toContain("Rappel demandé — Koffi A. (+2290197123456) : https://callpme.com/leads");
    expect(b.text).toContain("https://callpme.com/calls/c_1");
    expect(b.html).toContain('href="https://callpme.com/overview"');
    expect(b.html).toContain('href="https://callpme.com/calls/c_1"');
  });

  it("singulier, et pas d'appel sortant affiché s'il n'y en a pas", () => {
    const b = buildDigest(sample({ calls: { received: 1, missed: 1, outbound: 0 }, appointments: 1, leads: 1, urgent: [] }), "https://x.bj");
    expect(b.text).toContain("1 appel reçu, dont 1 manqué");
    expect(b.text).toContain("1 rendez-vous pris");
    expect(b.text).toContain("1 fiche client créée");
    expect(b.text).not.toContain("sortant");
    expect(b.subject).not.toContain("urgence");
  });

  it("échappe le HTML venant des appelants", () => {
    const b = buildDigest(sample({ urgent: [{ label: "Rappel demandé — <script>x</script>", href: "/leads" }] }), "https://x.bj");
    expect(b.html).not.toContain("<script>x");
    expect(b.html).toContain("&lt;script&gt;");
  });

  it("paramètre WhatsApp sur une seule ligne et borné", () => {
    const b = buildDigest(sample(), "https://callpme.com");
    expect(b.whatsappParam).not.toMatch(/[\n\t]| {2,}/);
    expect(b.whatsappParam).toContain("12 appels reçus");
    expect(oneLine("a\n\n b".repeat(500)).length).toBeLessThanOrEqual(900);
  });

  it("journée vide = pas d'activité", () => {
    expect(
      hasActivity(sample({ calls: { received: 0, missed: 0, outbound: 0 }, callbacks: { completed: 0, unreached: 0 }, appointments: 0, leads: 0, urgent: [] })),
    ).toBe(false);
    expect(hasActivity(sample())).toBe(true);
  });
});

describe("résumé quotidien — envoi et dédoublonnage", () => {
  const AT_19H = new Date("2026-11-07T18:05:00Z");
  const org = (alerts: object | null = null, whatsapp: { phoneNumberId: string; accessToken: string; enabled: boolean } | null = null) => ({
    id: "o1",
    name: "Pharmacie du Port",
    alerts: alerts ? JSON.stringify(alerts) : null,
    country: "BJ",
    whatsapp,
  });

  beforeEach(() => {
    db.state.counters = [];
    db.state.counts = { inbound: 4, missed: 1, outbound: 0, cbCompleted: 1, cbUnreached: 0, appointments: 1, leads: 2 };
    db.state.urgentLeads = [{ name: "Awa", phone: "+2290197000000", kind: "callback" }];
    db.state.unreached = [];
    sendEmail.mockClear();
    sendTemplate.mockClear();
    sendTemplate.mockResolvedValue(true);
  });

  it("une seule fois par jour et par organisation", async () => {
    expect(await sendDailyDigest(org(), AT_19H)).toBe("email");
    expect(await sendDailyDigest(org(), new Date("2026-11-07T19:00:00Z"))).toBe("already_sent");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: ["gerant@exemple.bj"] });
    // Le lendemain, nouveau résumé.
    expect(await sendDailyDigest(org(), new Date("2026-11-08T18:05:00Z"))).toBe("email");
  });

  it("verrou atomique : deux instances simultanées, un seul gagnant", async () => {
    const [a, b] = await Promise.all([claimDigest("o2", "2026-11-07"), claimDigest("o2", "2026-11-07")]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("rien hors de l'heure, rien si désactivé, rien si la journée est vide", async () => {
    expect(await sendDailyDigest(org(), new Date("2026-11-07T10:00:00Z"))).toBe("not_due");
    expect(await sendDailyDigest(org({ email: true, events: [], recipients: [], digest: { ...DEFAULT_DIGEST, enabled: false } }), AT_19H)).toBe(
      "disabled",
    );
    db.state.counts = { inbound: 0, missed: 0, outbound: 0, cbCompleted: 0, cbUnreached: 0, appointments: 0, leads: 0 };
    db.state.urgentLeads = [];
    expect(await sendDailyDigest(org(), AT_19H)).toBe("empty");
    expect(db.state.counters).toHaveLength(0); // pas de verrou : la journée peut encore se remplir
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("WhatsApp par modèle approuvé si le canal est configuré", async () => {
    const alerts = { email: true, events: [], recipients: [], digest: { ...DEFAULT_DIGEST, whatsappTo: ["+2290197123456"], whatsappTemplate: "resume_quotidien" } };
    expect(await sendDailyDigest(org(alerts, { phoneNumberId: "pn1", accessToken: "tok", enabled: true }), AT_19H)).toBe("whatsapp");
    expect(sendTemplate).toHaveBeenCalledWith("pn1", "tok", "+2290197123456", expect.objectContaining({ name: "resume_quotidien", language: "fr" }));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("jeton WhatsApp illisible après le verrou : repli e-mail quand même", async () => {
    const alerts = { email: true, events: [], recipients: [], digest: { ...DEFAULT_DIGEST, whatsappTo: ["+2290197123456"], whatsappTemplate: "resume_quotidien" } };
    expect(await sendDailyDigest(org(alerts, { phoneNumberId: "pn1", accessToken: "corrompu", enabled: true }), AT_19H)).toBe("email");
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("repli e-mail si le modèle WhatsApp est refusé, ou s'il n'y a pas de modèle", async () => {
    const alerts = { email: true, events: [], recipients: [], digest: { ...DEFAULT_DIGEST, whatsappTo: ["+2290197123456"], whatsappTemplate: "resume_quotidien" } };
    sendTemplate.mockResolvedValue(false);
    expect(await sendDailyDigest(org(alerts, { phoneNumberId: "pn1", accessToken: "tok", enabled: true }), AT_19H)).toBe("email");
    db.state.counters = [];
    sendTemplate.mockClear();
    const noTemplate = { ...alerts, digest: { ...alerts.digest, whatsappTemplate: "" } };
    expect(await sendDailyDigest(org(noTemplate, { phoneNumberId: "pn1", accessToken: "tok", enabled: true }), AT_19H)).toBe("email");
    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
