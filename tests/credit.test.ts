import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fausse base en mémoire : solde de l'organisation et réservations. */
const db = vi.hoisted(() => {
  const state = { credit: 0, holds: new Map<string, Record<string, unknown>>(), seq: 0 };
  const prisma = {
    organization: {
      findUnique: async () => ({ callCreditCents: state.credit }),
      update: async ({ data }: { data: { callCreditCents: { increment: number } } }) => {
        state.credit += data.callCreditCents.increment;
        return {};
      },
    },
    // UPDATE … SET credit = credit - x WHERE … credit >= x  (prélèvement conditionnel atomique)
    $executeRaw: async (_s: TemplateStringsArray, cents: number) => {
      if (state.credit < cents) return 0;
      state.credit -= cents;
      return 1;
    },
    outboundHold: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const h = { id: `h${++state.seq}`, chargedCents: 0, settled: false, providerCallId: null, sessionSec: null, ...data };
        state.holds.set(h.id, h);
        return h;
      },
      findUnique: async ({ where }: { where: { id?: string; providerCallId?: string } }) =>
        where.id ? state.holds.get(where.id) ?? null : Array.from(state.holds.values()).find((h) => h.providerCallId === where.providerCallId) ?? null,
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(state.holds.get(where.id)!, data),
      updateMany: async ({ where, data }: { where: { id: string; settled?: boolean }; data: Record<string, unknown> }) => {
        const h = state.holds.get(where.id);
        if (!h || (where.settled === false && h.settled)) return { count: 0 };
        for (const [k, v] of Object.entries(data)) {
          h[k] = v && typeof v === "object" && "increment" in v ? (h[k] as number) + (v as { increment: number }).increment : v;
        }
        return { count: 1 };
      },
    },
  };
  return { state, prisma };
});
vi.mock("@/lib/db/client", () => ({ prisma: db.prisma }));

import { extendHold, releaseHold, reserveOutbound, settleHold, talkSecondsForHold } from "@/lib/billing/credit";
import { outboundRateCents } from "@/lib/billing/outbound-rates";

const BENIN = "+22997000000";
const rate = outboundRateCents(BENIN);

beforeEach(() => {
  db.state.credit = 0;
  db.state.holds.clear();
});

describe("crédit des appels sortants : réservation", () => {
  it("refuse sans au moins 2 minutes de crédit, et les destinations fermées", async () => {
    db.state.credit = rate * 2 - 1;
    expect((await reserveOutbound("o", BENIN)).code).toBe("insufficient_credit");
    db.state.credit = 10_000;
    expect((await reserveOutbound("o", "+442079460000")).code).toBe("destination");
  });

  it("deux appels simultanés ne dépensent jamais le même crédit", async () => {
    db.state.credit = rate * 5; // de quoi réserver 5 minutes en tout
    const [a, b] = await Promise.all([reserveOutbound("o", BENIN, 180), reserveOutbound("o", BENIN, 180)]);
    const held = Array.from(db.state.holds.values()).reduce((s, h) => s + (h.holdCents as number), 0);
    expect(held + db.state.credit).toBe(rate * 5); // rien n'est créé ni perdu
    expect(db.state.credit).toBeGreaterThanOrEqual(0);
    expect([a.ok, b.ok].filter(Boolean).length).toBeGreaterThanOrEqual(1);
  });

  it("la conversation permise laisse une marge pour le répondeur et l'arrondi", async () => {
    db.state.credit = rate * 10;
    const r = await reserveOutbound("o", BENIN, 120);
    const h = db.state.holds.get(r.holdId!)!;
    expect(h.holdCents).toBe(3 * rate); // 120 s + 45 s de marge → 3 minutes
    expect(talkSecondsForHold(h as { holdCents: number; rateCents: number })).toBe(135);
  });
});

describe("crédit des appels sortants : règlement", () => {
  it("facture la durée de l'opérateur à la minute entamée et rend le reste, une seule fois", async () => {
    db.state.credit = rate * 10;
    const r = await reserveOutbound("o", BENIN, 600);
    db.state.holds.get(r.holdId!)!.providerCallId = "CA1";
    expect(await settleHold({ providerCallId: "CA1" }, 61)).toBe(2 * rate);
    expect(db.state.credit).toBe(rate * 8);
    expect(await settleHold({ providerCallId: "CA1" }, 61)).toBeNull(); // rappel en double : rien
    expect(db.state.credit).toBe(rate * 8);
  });

  it("ne facture jamais plus que la réservation", async () => {
    db.state.credit = rate * 3;
    const r = await reserveOutbound("o", BENIN, 600);
    expect(await settleHold({ id: r.holdId! }, 3600)).toBe(3 * rate);
    expect(db.state.credit).toBe(0);
  });

  it("un appel qui ne part pas est entièrement rendu", async () => {
    db.state.credit = rate * 4;
    const r = await reserveOutbound("o", BENIN, 600);
    await releaseHold(r.holdId!);
    expect(db.state.credit).toBe(rate * 4);
  });

  it("un transfert n'est prépayé que si le crédit le couvre", async () => {
    db.state.credit = rate * 3;
    const r = await reserveOutbound("o", BENIN, 60);
    expect(await extendHold(r.holdId!, "o", 10 * rate)).toBe(false);
    db.state.credit += 10 * rate;
    expect(await extendHold(r.holdId!, "o", 10 * rate)).toBe(true);
  });
});
