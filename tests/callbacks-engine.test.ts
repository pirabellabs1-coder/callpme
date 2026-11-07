import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fausse base en mémoire : rappels, numéros de la plateforme, battement de cœur. */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string; organizationId: string; phone: string; status: string; dueAt: Date; createdAt: Date; attempts: number };
  const state = { rows: [] as Row[], ownNumbers: new Set<string>(), heartbeat: 0, seq: 0 };
  const match = (r: Row, w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === "OR") return (v as Record<string, unknown>[]).some((o) => match(r, o));
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const c = v as { in?: unknown[]; gte?: Date; lte?: Date; lt?: Date };
        if (c.in) return c.in.includes(r[k]);
        const t = (r[k] as Date).getTime();
        return (!c.gte || t >= c.gte.getTime()) && (!c.lte || t <= c.lte.getTime()) && (!c.lt || t < c.lt.getTime());
      }
      return r[k] === v;
    });
  const callback = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => state.rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: { where: Record<string, unknown> }) => state.rows.filter((r) => match(r, where)),
    count: async ({ where }: { where: Record<string, unknown> }) => state.rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const r = { id: `c${++state.seq}`, status: "pending", attempts: 0, createdAt: new Date(), providerCallId: null, callId: null, ...data } as unknown as Row;
      state.rows.push(r);
      return r;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
      Object.assign(state.rows.find((r) => r.id === where.id)!, data),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = state.rows.filter((r) => match(r, where));
      for (const r of hit) {
        for (const [k, v] of Object.entries(data)) {
          r[k] = v && typeof v === "object" && "increment" in v ? (r[k] as number) + (v as { increment: number }).increment : v;
        }
      }
      return { count: hit.length };
    },
  };
  const prisma = {
    callback,
    phoneNumber: { findUnique: async ({ where }: { where: { number: string } }) => (state.ownNumbers.has(where.number) ? { id: "n" } : null) },
    platformSetting: {
      findUnique: async () => (state.heartbeat ? { value: String(state.heartbeat) } : null),
      upsert: async ({ create }: { create: { value: string } }) => {
        state.heartbeat = Number(create.value);
        return {};
      },
    },
    $queryRaw: async () => [{ locked: 1 }],
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { state, prisma };
});
const place = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/client", () => ({ prisma: db.prisma }));
vi.mock("@/lib/geo/org-country", () => ({ orgCountry: async () => "BJ" }));
vi.mock("@/lib/billing/limits", () => ({ canCallOut: async () => ({ ok: true }) }));
vi.mock("@/lib/campaigns/engine", () => ({ isOptedOut: async (_o: string, p: string) => p === "+22997999999" }));
vi.mock("@/lib/telephony/provider", () => ({ placeOutboundCall: place, telephonyConfigured: () => true }));
vi.mock("@/lib/db/agents", () => ({ getAgentById: async () => agent }));

import { recordCallbackOutcome, requestCallback, tickCallbacks } from "@/lib/callbacks/engine";
import { CALLBACK_MAX_DURATION_SEC } from "@/lib/callbacks/settings";
import type { Agent } from "@/lib/shared/types";

const agent = {
  id: "a1",
  organizationId: "o1",
  status: "active",
  name: "Awa",
  config: { callback: { enabled: true, mode: "flash", delaySec: 10, maxPerDay: 2 } },
} as unknown as Agent;
const CALLER = "+22997000000";

beforeEach(() => {
  db.state.rows = [];
  db.state.ownNumbers.clear();
  db.state.heartbeat = Date.now();
  place.mockReset();
});

describe("file de rappel", () => {
  it("un bip et le rappel de statut du même appel donnent un seul rappel", async () => {
    const a = await requestCallback({ agent, from: CALLER, reason: "flash" });
    const b = await requestCallback({ agent, from: CALLER, reason: "missed" });
    expect(a.ok && b.ok && a.id === b.id).toBe(true);
    expect(db.state.rows).toHaveLength(1);
  });

  it("jamais un numéro de la plateforme ni la liste d'opposition", async () => {
    db.state.ownNumbers.add(CALLER);
    expect(await requestCallback({ agent, from: CALLER, reason: "missed" })).toEqual({ ok: false, reason: "own_number" });
    expect(await requestCallback({ agent, from: "+22997999999", reason: "missed" })).toEqual({ ok: false, reason: "opted_out" });
  });

  it("mode bip : sans moteur de rappel actif, l'appel n'est pas refusé (l'agent décroche)", async () => {
    db.state.heartbeat = Date.now() - 5 * 60_000;
    expect(await requestCallback({ agent, from: CALLER, reason: "flash" })).toEqual({ ok: false, reason: "engine" });
    // Un appel manqué reste en file : il sera rappelé dès que le moteur repart.
    expect((await requestCallback({ agent, from: CALLER, reason: "missed" })).ok).toBe(true);
  });

  it("plafond par numéro sur 24 h", async () => {
    for (let i = 0; i < 2; i++) {
      await requestCallback({ agent, from: CALLER, reason: "missed" });
      db.state.rows.forEach((r) => (r.status = "completed"));
    }
    expect(await requestCallback({ agent, from: CALLER, reason: "missed" })).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("compose les rappels échus avec un plafond de durée, et relance une fois sans réponse", async () => {
    place.mockResolvedValue({ ok: true, callId: "CA1" });
    const r = await requestCallback({ agent, from: CALLER, reason: "missed", now: new Date(Date.now() - 60_000) });
    expect(r.ok).toBe(true);
    expect((await tickCallbacks()).placed).toBe(1);
    expect(place).toHaveBeenCalledWith(expect.objectContaining({ toNumber: CALLER, maxDurationSec: CALLBACK_MAX_DURATION_SEC }));
    expect(db.state.rows[0]).toMatchObject({ status: "calling", attempts: 1, providerCallId: "CA1" });

    await recordCallbackOutcome({ providerCallId: "CA1" }, "no_answer");
    expect(db.state.rows[0].status).toBe("pending");
    // Une issue tardive en double n'écrase rien.
    await recordCallbackOutcome({ providerCallId: "CA1" }, "failed");
    expect(db.state.rows[0].status).toBe("pending");
  });

  it("crédit épuisé au moment de composer : rappel clos en échec", async () => {
    place.mockResolvedValue({ ok: false, code: "insufficient_credit" });
    await requestCallback({ agent, from: CALLER, reason: "missed", now: new Date(Date.now() - 60_000) });
    expect((await tickCallbacks()).failed).toBe(1);
    expect(db.state.rows[0]).toMatchObject({ status: "failed", outcome: "Crédit d'appels insuffisant" });
  });
});
