import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

const db = vi.hoisted(() => ({
  phones: [] as { number: string; connectionId: string | null }[],
  connections: [] as { id: string; provider: string; enabled: boolean; accountKey: string | null; accountSid: string; authToken: string; organizationId: string }[],
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    phoneNumber: { findUnique: async ({ where }: { where: { number: string } }) => db.phones.find((p) => p.number === where.number) ?? null },
    providerConnection: {
      findMany: async ({ where }: { where: { accountKey: string } }) => db.connections.filter((c) => c.accountKey === where.accountKey && c.enabled),
      findFirst: async ({ where }: { where: { id: string; organizationId?: string } }) =>
        db.connections.find((c) => c.id === where.id && (!where.organizationId || c.organizationId === where.organizationId)) ?? null,
    },
  },
}));

import { accountKey, checkTwilioCredentials, connectionCreds, fetchTwilioCall, signerOwnsNumber, startTwilioRecording, verifyTwilioWebhook } from "@/lib/telephony/twilio-accounts";

const SID = "AC" + "a".repeat(32);
const TOKEN = "b".repeat(32);
const URL_ = "https://callpme.com/api/telephony/inbound";

function sign(token: string, params: Record<string, string>) {
  const data = URL_ + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", token).update(data).digest("base64");
}

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  db.connections.length = 0;
  db.phones.length = 0;
  vi.unstubAllGlobals();
});

describe("comptes Twilio des clients", () => {
  it("authentifie un webhook signé par le compte du client (et seulement lui)", async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    db.connections.push({ id: "c1", provider: "twilio", enabled: true, accountKey: accountKey(SID), accountSid: SID, authToken: TOKEN, organizationId: "o1" });
    const params = { AccountSid: SID, To: "+33219121925", From: "+22901000000", CallSid: "CA1" };
    const ok = await verifyTwilioWebhook(URL_, params, sign(TOKEN, params));
    expect(ok).toMatchObject({ sid: SID, connectionId: "c1" });
    // Mauvais jeton, ou paramètres modifiés : refus.
    expect(await verifyTwilioWebhook(URL_, params, sign("c".repeat(32), params))).toBeNull();
    expect(await verifyTwilioWebhook(URL_, { ...params, To: "+33100000000" }, sign(TOKEN, params))).toBeNull();
    // Compte inconnu.
    const other = { ...params, AccountSid: "AC" + "d".repeat(32) };
    expect(await verifyTwilioWebhook(URL_, other, sign(TOKEN, other))).toBeNull();
  });

  it("accepte aussi le compte Twilio de la plateforme", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC" + "e".repeat(32);
    process.env.TWILIO_AUTH_TOKEN = "f".repeat(32);
    const params = { AccountSid: process.env.TWILIO_ACCOUNT_SID, CallSid: "CA2" };
    const ok = await verifyTwilioWebhook(URL_, params, sign(process.env.TWILIO_AUTH_TOKEN, params));
    expect(ok?.connectionId).toBeUndefined();
  });

  it("ne lit les identifiants d'un compte que pour son organisation", async () => {
    db.connections.push({ id: "c1", provider: "twilio", enabled: true, accountKey: accountKey(SID), accountSid: SID, authToken: TOKEN, organizationId: "o1" });
    expect(await connectionCreds("c1", "o1")).toMatchObject({ sid: SID, token: TOKEN });
    expect(await connectionCreds("c1", "o2")).toBeNull();
  });

  it("vérifie les identifiants auprès de Twilio avant de les enregistrer", async () => {
    expect(await checkTwilioCredentials("pas-un-sid", TOKEN)).toMatchObject({ ok: false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect(await checkTwilioCredentials(SID, TOKEN)).toMatchObject({ ok: false, error: expect.stringContaining("refuse") });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ friendly_name: "Pirabel", status: "active" }), { status: 200 })));
    expect(await checkTwilioCredentials(SID, TOKEN)).toEqual({ ok: true, name: "Pirabel" });
  });

  it("un compte client ne peut agir que sur SES numéros (jamais ceux d'un autre client ni de la plateforme)", async () => {
    db.phones.push({ number: "+33219121925", connectionId: "c1" }, { number: "+22901970000", connectionId: null });
    expect(await signerOwnsNumber("+33219121925", "c1")).toBe(true);
    expect(await signerOwnsNumber("+33219121925", "c2")).toBe(false); // autre client
    expect(await signerOwnsNumber("+33219121925", undefined)).toBe(false); // plateforme
    expect(await signerOwnsNumber("+22901970000", "c1")).toBe(false); // numéro plateforme / marketplace
    expect(await signerOwnsNumber("+22901970000", undefined)).toBe(true);
  });

  it("relit un appel chez Twilio (durée facturée réelle, appel du bon compte)", async () => {
    const creds = { sid: SID, token: TOKEN, connectionId: "c1" };
    expect(await fetchTwilioCall(creds, "pas-un-callsid")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await fetchTwilioCall(creds, "CA" + "1".repeat(32))).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "completed", duration: "47", direction: "outbound-api", to: "+229", from: "+33" }), { status: 200 })),
    );
    expect(await fetchTwilioCall(creds, "CA" + "1".repeat(32))).toMatchObject({ status: "completed", duration: 47 });
  });

  it("démarre l'enregistrement deux canaux d'un appel Twilio", async () => {
    const creds = { sid: SID, token: TOKEN };
    expect(await startTwilioRecording(creds, "pas-un-callsid")).toBeNull();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "RE" + "2".repeat(32) }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await startTwilioRecording(creds, "CA" + "1".repeat(32))).toBe("RE" + "2".repeat(32));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/Calls/CA${"1".repeat(32)}/Recordings.json`);
    expect(String(init.body)).toContain("RecordingChannels=dual");
  });
});
