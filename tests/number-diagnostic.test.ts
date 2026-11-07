import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  number: null as Record<string, unknown> | null,
  agent: null as Record<string, unknown> | null,
  credit: 0,
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    phoneNumber: { findFirst: async () => db.number },
    agent: { findFirst: async () => db.agent },
  },
}));
vi.mock("@/lib/billing/credit", () => ({ creditBalanceCents: async () => db.credit, OUTBOUND_MIN_MINUTES: 2 }));
vi.mock("@/lib/telephony/twilio-accounts", async (orig) => {
  const real = await orig<typeof import("@/lib/telephony/twilio-accounts")>();
  return {
    ...real,
    connectionCreds: async () => ({ sid: "AC" + "a".repeat(32), token: "b".repeat(32), connectionId: "c1" }),
    checkTwilioCredentials: async () => ({ ok: true, name: "Pirabel" }),
    listTwilioNumbers: async () => [{ sid: "PN1", phoneNumber: "+33219121925", friendlyName: "Test", voice: true, linked: true }],
  };
});

import { diagnoseNumber } from "@/lib/telephony/diagnostics";
import { twilioErrorFr } from "@/lib/telephony/twilio-accounts";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

/** Réponses de Twilio et du serveur vocal selon l'URL appelée. */
function stubNetwork(opts: { profile: string; geo: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/health")) return new Response("ok", { status: 200 });
      if (url.includes("CustomerProfiles")) return new Response(JSON.stringify({ results: [{ status: opts.profile }] }), { status: 200 });
      if (url.includes("DialingPermissions")) return new Response(JSON.stringify({ low_risk_numbers_enabled: opts.geo }), { status: 200 });
      return new Response("{}", { status: 404 });
    }),
  );
}

describe("diagnostic d'un numéro", () => {
  it("entrants prêts, sortants bloqués tant que le profil Twilio n'est pas approuvé", async () => {
    process.env.VOICE_SERVER_URL = "wss://voix.test";
    db.number = { id: "n1", number: "+33219121925", status: "active", provider: "twilio", connectionId: "c1" };
    db.agent = { name: "Secrétaire médicale", status: "active" };
    db.credit = 300;
    stubNetwork({ profile: "in-review", geo: true });
    const d = await diagnoseNumber("o1", "n1");
    expect(d?.inboundReady).toBe(true);
    expect(d?.outboundReady).toBe(true); // en examen = avertissement, pas erreur
    expect(d?.checks.find((c) => c.id === "compliance")).toMatchObject({ status: "warn" });

    stubNetwork({ profile: "draft", geo: false });
    const d2 = await diagnoseNumber("o1", "n1");
    expect(d2?.outboundReady).toBe(false);
    expect(d2?.checks.find((c) => c.id === "compliance")).toMatchObject({ status: "error" });
    expect(d2?.checks.find((c) => c.id === "geo")).toMatchObject({ status: "warn" });
  });

  it("signale un agent hors ligne et un crédit vide", async () => {
    process.env.VOICE_SERVER_URL = "wss://voix.test";
    db.number = { id: "n1", number: "+33219121925", status: "active", provider: "twilio", connectionId: "c1" };
    db.agent = { name: "Secrétaire médicale", status: "draft" };
    db.credit = 0;
    stubNetwork({ profile: "twilio-approved", geo: true });
    const d = await diagnoseNumber("o1", "n1");
    expect(d?.inboundReady).toBe(false);
    expect(d?.checks.find((c) => c.id === "agent")).toMatchObject({ status: "error" });
    expect(d?.checks.find((c) => c.id === "credit")).toMatchObject({ status: "warn" });
  });

  it("numéro d'une autre organisation : rien", async () => {
    db.number = null;
    expect(await diagnoseNumber("o1", "n9")).toBeNull();
  });
});

describe("refus Twilio en français", () => {
  it("traduit les refus courants", () => {
    expect(twilioErrorFr(undefined, "Primary compliance profile is not approved.")).toContain("profil de conformité");
    expect(twilioErrorFr(21215, "Account not authorized to call +229…")).toContain("pays n'est pas autorisé");
    expect(twilioErrorFr(21219, "trial")).toContain("Compte Twilio d'essai");
    expect(twilioErrorFr(99999, "Something odd")).toBe("Twilio a refusé l'appel : Something odd");
  });
});
