import { beforeEach, describe, expect, it, vi } from "vitest";

/** Rendez-vous en mémoire (filtres utilisés par la réservation). */
const db = vi.hoisted(() => {
  const rows: Record<string, unknown>[] = [];
  let seq = 0;
  const match = (r: Record<string, unknown>, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === "OR") return (v as Record<string, unknown>[]).length > 0 && (v as Record<string, unknown>[]).some((x) => match(r, x));
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const o = v as { gte?: Date; lt?: Date };
        const t = (r[k] as Date).getTime();
        return (!o.gte || t >= o.gte.getTime()) && (!o.lt || t < o.lt.getTime());
      }
      return r[k] === v;
    });
  const prisma = {
    appointment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => match(r, where)).sort((a, b) => (a.startsAt as Date).getTime() - (b.startsAt as Date).getTime())[0] ?? null,
      count: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `a${++seq}`, status: "booked", ...data };
        rows.push(row);
        return row;
      },
      update: async () => ({}),
    },
  };
  return { rows, prisma };
});

vi.mock("@/lib/db/client", () => ({ prisma: db.prisma }));
vi.mock("@/lib/geo/org-country", () => ({ orgCountry: async () => "BJ" }));
vi.mock("@/lib/integrations/google-calendar", () => ({ googleBusy: async () => [], createGoogleEvent: async () => null, deleteGoogleEvent: async () => {} }));
vi.mock("@/lib/telephony/sms", () => ({ sendSms: async () => {} }));
vi.mock("@/lib/db/notifications", () => ({ createNotification: async () => {} }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchEvent: async () => {} }));

import { bookAppointment } from "@/lib/agenda/service";
import type { Agent } from "@/lib/shared/types";

const agent = {
  id: "ag1",
  organizationId: "o1",
  clientId: null,
  config: {
    booking: {
      timezone: "Africa/Porto-Novo",
      durationMin: 30,
      hours: { 1: [["09:00", "12:00"], ["14:00", "18:00"]], 2: [["09:00", "12:00"]] },
      minNoticeMin: 60,
      maxDaysAhead: 60,
      smsConfirmation: false,
    },
  },
} as unknown as Agent;

// Samedi 7 novembre 2026, midi : lundi 9 et mardi 10 sont réservables.
const now = new Date("2026-11-07T11:00:00Z");
const CALLER = "+22901970000";

beforeEach(() => {
  db.rows.length = 0;
});

describe("pas de rendez-vous en double", () => {
  it("un même appel ne réserve qu'une fois, même pour un autre créneau", async () => {
    const first = await bookAppointment(agent, { name: "Gildas", date: "2026-11-09", time: "15:30" }, { callerNumber: CALLER, callRef: "call1", now });
    expect(first.ok).toBe(true);
    const again = await bookAppointment(agent, { name: "Gildas", date: "2026-11-09", time: "15:30" }, { callerNumber: CALLER, callRef: "call1", now });
    expect(again).toMatchObject({ ok: false, reference: first.reference });
    expect(again.message).toContain("déjà réservé");
    const other = await bookAppointment(agent, { name: "Gildas", date: "2026-11-10", time: "09:00" }, { callerNumber: CALLER, callRef: "call1", now });
    expect(other.ok).toBe(false);
    expect(other.message).toContain("DÉPLACER");
    expect(db.rows).toHaveLength(1);
  });

  it("un client qui rappelle est prévenu de son rendez-vous existant ; un second n'est pris que s'il le confirme", async () => {
    await bookAppointment(agent, { name: "Gildas", date: "2026-11-09", time: "15:30" }, { callerNumber: CALLER, callRef: "call1", now });
    const second = await bookAppointment(agent, { name: "Gildas", date: "2026-11-10", time: "09:00" }, { callerNumber: CALLER, callRef: "call2", now });
    expect(second.ok).toBe(false);
    expect(second.message).toContain("SUPPLÉMENTAIRE");
    const confirmed = await bookAppointment(
      agent,
      { name: "Gildas", date: "2026-11-10", time: "09:00", another: "true" },
      { callerNumber: CALLER, callRef: "call2", now },
    );
    expect(confirmed.ok).toBe(true);
    expect(db.rows).toHaveLength(2);
  });

  it("deux personnes dans le même appel : le second rendez-vous passe s'il est confirmé (another)", async () => {
    await bookAppointment(agent, { name: "Gildas", date: "2026-11-09", time: "15:30" }, { callerNumber: CALLER, callRef: "call1", now });
    const wife = await bookAppointment(
      agent,
      { name: "Awa", date: "2026-11-09", time: "16:00", another: true },
      { callerNumber: CALLER, callRef: "call1", now },
    );
    expect(wife.ok).toBe(true);
    // Même créneau redemandé : toujours refusé, même avec another.
    const same = await bookAppointment(agent, { name: "Awa", date: "2026-11-09", time: "15:30", another: true }, { callerNumber: CALLER, callRef: "call1", now });
    expect(same.ok).toBe(false);
  });

  it("un autre client réserve normalement", async () => {
    await bookAppointment(agent, { name: "Gildas", date: "2026-11-09", time: "15:30" }, { callerNumber: CALLER, callRef: "call1", now });
    const other = await bookAppointment(agent, { name: "Awa", date: "2026-11-09", time: "16:00" }, { callerNumber: "+22901000000", callRef: "call9", now });
    expect(other.ok).toBe(true);
  });
});
