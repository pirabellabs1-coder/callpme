import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatMarketNumber,
  matchesPrefix,
  numberRequestSchema,
  parseStockList,
  toMarketE164,
  xofToEur,
} from "@/lib/numbers/market";
import {
  approveNumberRequest,
  cancelNumberRequest,
  createNumberRequest,
  importStock,
  rejectNumberRequest,
  returnToStock,
  searchStock,
} from "@/lib/numbers/market-db";

/* ------------------------- Fausse base en mémoire ------------------------- */

type Row = Record<string, unknown>;

const db = vi.hoisted(() => {
  const state = {
    stock: [] as Row[],
    requests: [] as Row[],
    phones: [] as Row[],
    seq: 0,
  };

  /** Applique les filtres utilisés par market-db (égalité, in, not, OR). */
  function match(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (k === "OR") return (v as Row[]).some((w) => match(row, w));
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const o = v as { in?: unknown[]; not?: unknown; startsWith?: string };
        if (o.in) return o.in.includes(row[k]);
        if (o.startsWith !== undefined) return String(row[k]).startsWith(o.startsWith);
        if ("not" in o) return row[k] !== o.not;
      }
      return row[k] === v;
    });
  }

  function table(rows: () => Row[], defaults: () => Row) {
    return {
      findUnique: async ({ where }: { where: Row }) => rows().find((r) => match(r, where)) ?? null,
      findMany: async ({ where }: { where?: Row } = {}) => rows().filter((r) => match(r, where)),
      count: async ({ where }: { where?: Row } = {}) => rows().filter((r) => match(r, where)).length,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `id${++state.seq}`, ...defaults(), ...data };
        rows().push(row);
        return row;
      },
      createMany: async ({ data }: { data: Row[] }) => {
        let count = 0;
        for (const d of data) {
          if (rows().some((r) => r.number === d.number)) continue;
          rows().push({ id: `id${++state.seq}`, ...defaults(), ...d });
          count++;
        }
        return { count };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(rows().find((r) => match(r, where))!, data),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = rows().filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: { where: Row }) => {
        const before = rows().length;
        const keep = rows().filter((r) => !match(r, where));
        rows().splice(0, rows().length, ...keep);
        return { count: before - keep.length };
      },
    };
  }

  const prisma: Record<string, unknown> = {
    numberStock: table(() => state.stock, () => ({ status: "available", requestId: null, organizationId: null, kind: "mobile", setupPriceXof: 0 })),
    numberRequest: table(() => state.requests, () => ({ status: "pending", adminNote: null, assignedNumber: null })),
    phoneNumber: table(() => state.phones, () => ({ status: "active" })),
    organization: { findUnique: async () => ({ plan: "pro" }) },
  };
  prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { state, prisma };
});

vi.mock("@/lib/db/client", () => ({ prisma: db.prisma }));


// Plans : « pro » permet plusieurs numéros (getPlan est la vraie fonction).
const ORG = { id: "org1", plan: "pro" };
/** Entrée validée comme en production (types de sortie du schéma). */
const input = (o: Record<string, unknown>) => numberRequestSchema.parse({ ...contact, ...o });
const contact = {
  companyName: "Clinique Avenir",
  contactName: "Awa Dossou",
  contactPhone: "+229 01 97 00 00 00",
  contactEmail: "awa@clinique.bj",
  address: "Cotonou, Haie Vive",
};

beforeEach(() => {
  db.state.stock.length = 0;
  db.state.requests.length = 0;
  db.state.phones.length = 0;
});

/* ----------------------------- Règles pures ------------------------------ */

describe("marketplace des numéros — règles", () => {
  it("le filtre « commence par » ignore le 01 de tête au Bénin", () => {
    expect(matchesPrefix("+2290195123456", "BJ", "95")).toBe(true);
    expect(matchesPrefix("+2290195123456", "BJ", "0195")).toBe(true);
    expect(matchesPrefix("+2290166123456", "BJ", "95")).toBe(false);
    expect(matchesPrefix("+2290166123456", "BJ", "")).toBe(true);
  });

  it("normalise les numéros saisis par l'admin", () => {
    expect(toMarketE164("01 95 12 34 56", "BJ")).toBe("+2290195123456");
    expect(toMarketE164("+229 01 95 12 34 56", "BJ")).toBe("+2290195123456");
    expect(toMarketE164("+225 0707070707", "BJ")).toBeNull();
    expect(toMarketE164("12", "BJ")).toBeNull();
    expect(formatMarketNumber("+2290195123456", "BJ")).toBe("+229 01 95 12 34 56");
  });

  it("découpe une liste collée et signale les numéros invalides", () => {
    const { valid, invalid } = parseStockList("0195123456\n0195123456; abc, 0166001122", "BJ");
    expect(valid).toEqual(["+2290195123456", "+2290166001122"]);
    expect(invalid).toEqual(["abc"]);
  });

  it("refuse un réseau qui n'existe pas dans le pays", () => {
    expect(numberRequestSchema.safeParse({ country: "BJ", network: "orange", ...contact }).success).toBe(false);
    expect(numberRequestSchema.safeParse({ country: "BJ", network: "moov", ...contact }).success).toBe(true);
    expect(xofToEur(3000)).toBeCloseTo(4.57, 2);
  });
});

/* --------------------------- Cycle d'un numéro --------------------------- */

describe("marketplace des numéros — cycle", () => {
  async function seed() {
    await importStock({ country: "BJ", network: "mtn", kind: "mobile", monthlyPriceXof: 3000, setupPriceXof: 0, numbers: "0195123456\n0166001122" });
    return db.state.stock.map((s) => s.id as string);
  }

  it("recherche par réseau et début de numéro", async () => {
    await seed();
    expect((await searchStock({ country: "BJ", prefix: "95" })).map((o) => o.number)).toEqual(["+2290195123456"]);
    expect(await searchStock({ country: "BJ", network: "moov" })).toEqual([]);
  });

  it("réserve le numéro choisi, puis l'attribue et le crée actif chez le client", async () => {
    const [id] = await seed();
    const req = await createNumberRequest(ORG, "u1", input({ country: "BJ", stockId: id }));
    expect(db.state.stock[0]).toMatchObject({ status: "reserved", requestId: req.id });
    // Un deuxième client ne peut plus le réserver.
    await expect(createNumberRequest({ id: "org2", plan: "pro" }, "u2", input({ country: "BJ", stockId: id }))).rejects.toThrow(
      "réservé",
    );

    const res = await approveNumberRequest(req.id, null, "Bienvenue");
    expect(res.number).toBe("+2290195123456");
    expect(db.state.stock[0]).toMatchObject({ status: "assigned", organizationId: "org1" });
    expect(db.state.phones[0]).toMatchObject({ organizationId: "org1", number: "+2290195123456", status: "active", purchased: true });
    expect(db.state.requests.find((r) => r.id === req.id)).toMatchObject({ status: "approved", assignedNumber: "+2290195123456" });
    await expect(approveNumberRequest(req.id, null, null)).rejects.toThrow("déjà traitée");
  });

  it("une demande libre reçoit un numéro choisi par l'admin", async () => {
    const [, second] = await seed();
    const req = await createNumberRequest(ORG, "u1", input({ country: "BJ", network: "mtn", desiredPrefix: "66" }));
    await expect(approveNumberRequest(req.id, null, null)).rejects.toThrow("Choisissez");
    await approveNumberRequest(req.id, second, null);
    expect(db.state.phones[0].number).toBe("+2290166001122");
  });

  it("refus et annulation remettent le numéro en vente", async () => {
    const [a, b] = await seed();
    const r1 = await createNumberRequest(ORG, "u1", input({ country: "BJ", stockId: a }));
    await rejectNumberRequest(r1.id, "Pièces manquantes");
    expect(db.state.stock[0]).toMatchObject({ status: "available", requestId: null });

    const r2 = await createNumberRequest(ORG, "u1", input({ country: "BJ", stockId: b }));
    expect(await cancelNumberRequest("autre-org", r2.id)).toBe(false);
    expect(await cancelNumberRequest("org1", r2.id)).toBe(true);
    expect(db.state.stock[1]).toMatchObject({ status: "available" });
  });

  it("refuse d'attribuer une demande annulée, deux fois, ou un numéro d'un autre pays", async () => {
    const [a, b] = await seed();
    const r1 = await createNumberRequest(ORG, "u1", input({ country: "BJ", network: "mtn" }));
    await cancelNumberRequest("org1", r1.id);
    await expect(approveNumberRequest(r1.id, a, null)).rejects.toThrow("déjà traitée");

    const r2 = await createNumberRequest(ORG, "u1", input({ country: "BJ" }));
    await approveNumberRequest(r2.id, a, null);
    await expect(approveNumberRequest(r2.id, b, null)).rejects.toThrow("déjà traitée");
    expect(db.state.phones).toHaveLength(1);

    db.state.stock.push({ id: "ci1", number: "+2250707070707", country: "CI", network: "mtn", status: "available", monthlyPriceXof: 3000 });
    const r3 = await createNumberRequest(ORG, "u1", input({ country: "BJ" }));
    await expect(approveNumberRequest(r3.id, "ci1", null)).rejects.toThrow("pays demandé");
  });

  it("un numéro supprimé par le client revient dans le stock", async () => {
    const [id] = await seed();
    const req = await createNumberRequest(ORG, "u1", input({ country: "BJ", stockId: id }));
    await approveNumberRequest(req.id, null, null);
    await returnToStock("org1", "+2290195123456");
    expect(db.state.stock[0]).toMatchObject({ status: "disabled", organizationId: null });
  });

  it("limite les demandes ouvertes et respecte la limite de l'offre", async () => {
    await createNumberRequest({ id: "org3", plan: "essentiel" }, "u", input({ country: "CI" }));
    await expect(createNumberRequest({ id: "org3", plan: "essentiel" }, "u", input({ country: "CI" }))).rejects.toThrow("permet");
  });

  it("l'import ignore les doublons et les numéros déjà utilisés", async () => {
    db.state.phones.push({ id: "p0", number: "+2290166001122", organizationId: "x" });
    const res = await importStock({ country: "BJ", network: "moov", kind: "mobile", monthlyPriceXof: 2500, setupPriceXof: 0, numbers: "0195123456, 0166001122, 0195123456" });
    expect(res).toMatchObject({ added: 1, skipped: 1 });
    const again = await importStock({ country: "BJ", network: "moov", kind: "mobile", monthlyPriceXof: 2500, setupPriceXof: 0, numbers: "0195123456" });
    expect(again).toMatchObject({ added: 0, skipped: 1 });
  });
});
