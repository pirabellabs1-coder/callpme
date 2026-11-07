import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  paymentSettings: { findUnique: vi.fn() },
  paymentRequest: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  organization: { findUnique: vi.fn() },
  whatsAppChannel: { findUnique: vi.fn() },
}));
const notify = vi.hoisted(() => vi.fn(async () => ({})));
const sms = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("@/lib/db/notifications", () => ({ createNotification: notify }));
vi.mock("@/lib/telephony/sms", () => ({ sendSms: sms }));
vi.mock("@/lib/crypto/secrets", () => ({ decryptSecret: (v: string | null) => v }));

import { verifyGeniusWebhook } from "@/lib/payments/geniuspay";
import {
  HARD_MAX_XOF,
  parseItemLines,
  paymentIdempotencyKey,
  paymentStatusFrom,
  resolvePaymentAmount,
  toXof,
  type PaymentRules,
} from "@/lib/payments/merchant-rules";
import { checkPaymentTool, confirmPaymentRequest, handleMerchantWebhook, requestPaymentTool } from "@/lib/payments/merchant";

const SECRET = "whsec_test_0123456789abcdef";
const TOKEN = "tok_ABCDEFGHIJKLMNOPQRSTUVWX";
const sign = (body: string, ts: string, secret = SECRET) => createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

const settingsRow = {
  organizationId: "org1",
  enabled: true,
  apiKey: "pk_sandbox_x",
  apiSecret: "sk_sandbox_y",
  webhookSecret: SECRET,
  webhookToken: TOKEN,
  currency: "XOF",
  maxAmount: 50000,
  allowCustomAmount: false,
  items: JSON.stringify([{ label: "Consultation", amount: 5000 }, { label: "Frais de scolarité", amount: 75000 }]),
  delivery: "sms",
};

const ctx = { agentId: "ag1", organizationId: "org1", callId: "sess1", callerNumber: "+22997000000" };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("montants et tarifs", () => {
  const rules: PaymentRules = { currency: "XOF", maxAmount: 50000, allowCustomAmount: false, items: [{ label: "Consultation", amount: 5000 }] };

  it("convertit les euros au centime près et refuse les FCFA décimaux", () => {
    expect(toXof(10, "EUR")).toBe(6560);
    expect(toXof(10.5, "EUR")).toBe(6888);
    expect(toXof(10.123, "EUR")).toBeNull();
    expect(toXof(5000, "XOF")).toBe(5000);
    expect(toXof(5000.5, "XOF")).toBeNull();
    expect(toXof(-1, "XOF")).toBeNull();
    expect(toXof(Number.NaN, "XOF")).toBeNull();
  });

  it("utilise le tarif de l'entreprise, sans tenir compte des accents ni de la casse", () => {
    const r = resolvePaymentAmount({ item: "consultation" }, rules);
    expect(r).toEqual({ ok: true, amount: 5000, amountXof: 5000, item: "Consultation" });
  });

  it("refuse un montant libre quand l'entreprise ne l'autorise pas", () => {
    const r = resolvePaymentAmount({ amount: 1000 }, rules);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Consultation/);
  });

  it("applique le minimum GeniusPay et le plafond de l'entreprise", () => {
    const free = { ...rules, allowCustomAmount: true };
    expect(resolvePaymentAmount({ amount: 150 }, free).ok).toBe(false);
    expect(resolvePaymentAmount({ amount: 50000 }, free).ok).toBe(true);
    expect(resolvePaymentAmount({ amount: 50001 }, free).ok).toBe(false);
    expect(resolvePaymentAmount({ amount: "12 000" }, free)).toMatchObject({ ok: true, amountXof: 12000 });
  });

  it("borne tout réglage par le plafond absolu", () => {
    const huge = { ...rules, allowCustomAmount: true, maxAmount: 10 * HARD_MAX_XOF };
    expect(resolvePaymentAmount({ amount: HARD_MAX_XOF + 1 }, huge).ok).toBe(false);
  });

  it("lit les tarifs saisis ligne par ligne", () => {
    expect(parseItemLines("Consultation = 5 000\nScolarité : 75.000 FCFA", "XOF")).toEqual({
      items: [
        { label: "Consultation", amount: 5000 },
        { label: "Scolarité", amount: 75000 },
      ],
    });
    expect(parseItemLines("Acompte = 10,50 €", "EUR")).toEqual({ items: [{ label: "Acompte", amount: 10.5 }] });
    expect(parseItemLines("Consultation", "XOF")).toHaveProperty("error");
    expect(parseItemLines("A = 1000\na = 2000", "XOF")).toHaveProperty("error");
  });

  it("traduit les statuts GeniusPay", () => {
    expect(paymentStatusFrom("completed")).toBe("completed");
    expect(paymentStatusFrom("expired")).toBe("failed");
    expect(paymentStatusFrom("pending")).toBe("pending");
    expect(paymentStatusFrom(null)).toBe("pending");
  });
});

describe("idempotence", () => {
  it("même appel, même montant, même motif → même clé ; sinon clé différente", () => {
    const a = paymentIdempotencyKey("org1", "sess1", 5000, "Consultation du 12 mars");
    expect(paymentIdempotencyKey("org1", "sess1", 5000, "  consultation  du 12 MARS ")).toBe(a);
    expect(paymentIdempotencyKey("org1", "sess1", 6000, "Consultation du 12 mars")).not.toBe(a);
    expect(paymentIdempotencyKey("org1", "sess2", 5000, "Consultation du 12 mars")).not.toBe(a);
    expect(paymentIdempotencyKey("org2", "sess1", 5000, "Consultation du 12 mars")).not.toBe(a);
  });

  it("ne recrée ni ne renvoie un lien déjà envoyé", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue({ id: "pr1", status: "pending", reference: "GP-1", channel: "sms", createdAt: new Date() });
    const r = await requestPaymentTool({ item: "Consultation", reason: "Consultation" }, ctx);
    expect(r).toMatchObject({ ok: true, data: { alreadySent: true } });
    expect(db.paymentRequest.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sms).not.toHaveBeenCalled();
  });

  it("double appel simultané : la contrainte d'unicité évite un second lien", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue(null);
    db.paymentRequest.count.mockResolvedValue(0);
    db.paymentRequest.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await requestPaymentTool({ item: "Consultation", reason: "Consultation" }, ctx);
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sms).not.toHaveBeenCalled();
  });

  it("crée le lien sur le compte marchand et l'envoie par SMS à l'appelant", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ data: { checkout_url: "https://pay.example/c/1", reference: "GP-1" } }));
    vi.stubGlobal("fetch", fetchMock);
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue(null);
    db.paymentRequest.count.mockResolvedValue(0);
    db.paymentRequest.create.mockResolvedValue({ id: "pr1" });
    db.organization.findUnique.mockResolvedValue({ name: "Pharmacie du Port" });
    sms.mockResolvedValue({ ok: true });
    const r = await requestPaymentTool({ item: "Consultation", reason: "Consultation" }, ctx);
    expect(r).toMatchObject({ ok: true, data: { status: "pending", channel: "sms" } });
    const init = fetchMock.mock.calls[0][1] as RequestInit & { headers: Record<string, string>; body: string };
    expect(init.headers["X-API-Key"]).toBe("pk_sandbox_x");
    expect(JSON.parse(init.body)).toMatchObject({ amount: 5000, currency: "XOF", metadata: { paymentRequestId: "pr1" } });
    expect(sms).toHaveBeenCalledWith("+22997000000", expect.stringContaining("https://pay.example/c/1"), expect.objectContaining({ callId: "sess1" }));
  });

  it("après un échec, l'ancienne demande est conservée (clé libérée) et compte dans le plafond", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { checkout_url: "https://pay.example/c/2", reference: "GP-9" } })));
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue({ id: "old", status: "failed", reference: null, channel: null, createdAt: new Date() });
    db.paymentRequest.updateMany.mockResolvedValue({ count: 1 });
    db.paymentRequest.count.mockResolvedValue(3);
    const r = await requestPaymentTool({ item: "Consultation", reason: "Consultation" }, ctx);
    expect(db.paymentRequest.deleteMany).not.toHaveBeenCalled();
    expect(db.paymentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "old" }), data: expect.objectContaining({ idempotencyKey: expect.stringMatching(/:old$/) }) }),
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/maximal/);
    expect(db.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("un lien déjà créé mais pas encore marqué envoyé n'est jamais recréé", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue({ id: "pr5", status: "pending", reference: "GP-5", channel: null, createdAt: new Date(Date.now() - 10 * 60_000) });
    const r = await requestPaymentTool({ item: "Consultation", reason: "Consultation" }, ctx);
    expect(r.data).toMatchObject({ alreadySent: true });
    expect(db.paymentRequest.updateMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("une confirmation répétée ne notifie l'entreprise qu'une fois", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { status: "completed" } })));
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue({ id: "pr2", organizationId: "org1", status: "pending", reference: "GP-2", amount: 5000, currency: "XOF", reason: "x", createdAt: new Date() });
    db.paymentRequest.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await confirmPaymentRequest("pr2", { force: true })).toBe("completed");
    expect(await confirmPaymentRequest("pr2", { force: true })).toBe("completed");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(db.paymentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "pr2", status: "pending" } }));
  });
});

describe("garde-fous", () => {
  it("aucun outil de paiement n'agit en conversation de test", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r1 = await requestPaymentTool({ item: "Consultation", reason: "x" }, { ...ctx, test: true });
    const r2 = await checkPaymentTool({}, { ...ctx, test: true });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(db.paymentSettings.findUnique).not.toHaveBeenCalled();
    expect(db.paymentRequest.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuse un motif contenant un lien et toute conversation WhatsApp", async () => {
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    const r1 = await requestPaymentTool({ item: "Consultation", reason: "voir https://evil.example" }, ctx);
    expect(r1.ok).toBe(false);
    const r2 = await requestPaymentTool({ item: "Consultation", reason: "x" }, { ...ctx, callId: "wa_conv1" });
    expect(r2.ok).toBe(false);
    expect(db.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("checkPayment : statut de chaque demande, filtré sur l'appel et le numéro de l'appelant", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { status: "pending" } })));
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    const rows = [
      { id: "a", organizationId: "org1", status: "completed", reference: "GP-a", amount: 5000, currency: "XOF", reason: "Consultation", createdAt: new Date() },
      { id: "b", organizationId: "org1", status: "pending", reference: "GP-b", amount: 2000, currency: "XOF", reason: "Médicaments", createdAt: new Date() },
    ];
    db.paymentRequest.findMany.mockResolvedValue(rows);
    db.paymentRequest.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id));
    const r = await checkPaymentTool({}, ctx);
    expect(db.paymentRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ callRef: "sess1", customerPhone: "+22997000000" }) }));
    expect(r.message).toMatch(/Consultation\) : PAYÉ/);
    expect(r.message).toMatch(/Médicaments\) : pas encore reçu/);
  });

  it("une demande non payée depuis plus de 48 h expire", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { status: "pending" } })));
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue({ id: "old2", organizationId: "org1", status: "pending", reference: "GP-o", createdAt: new Date(Date.now() - 49 * 3600_000) });
    db.paymentRequest.updateMany.mockResolvedValue({ count: 1 });
    expect(await confirmPaymentRequest("old2", { force: true })).toBe("failed");
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuse si l'encaissement est désactivé", async () => {
    db.paymentSettings.findUnique.mockResolvedValue({ ...settingsRow, enabled: false });
    const r = await requestPaymentTool({ item: "Consultation", reason: "x" }, ctx);
    expect(r.ok).toBe(false);
    expect(db.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("refuse un montant au-delà du plafond", async () => {
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    const r = await requestPaymentTool({ item: "Frais de scolarité", reason: "Trimestre 1" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/plafond/);
    expect(db.paymentRequest.create).not.toHaveBeenCalled();
  });
});

describe("webhook marchand signé", () => {
  const body = JSON.stringify({ event: "payment.success", data: { metadata: { paymentRequestId: "pr3" } } });

  it("vérifie la signature HMAC et l'horodatage", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyGeniusWebhook(body, sign(body, ts), ts, SECRET)).toBe(true);
    expect(verifyGeniusWebhook(body, `sha256=${sign(body, ts)}`, ts, SECRET)).toBe(true);
    expect(verifyGeniusWebhook(body + " ", sign(body, ts), ts, SECRET)).toBe(false);
    expect(verifyGeniusWebhook(body, sign(body, ts, "autre-secret"), ts, SECRET)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 600);
    expect(verifyGeniusWebhook(body, sign(body, old), old, SECRET)).toBe(false);
    expect(verifyGeniusWebhook(body, null, ts, SECRET)).toBe(false);
  });

  it("rejette un jeton inconnu ou une mauvaise signature sans rien confirmer", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    db.paymentSettings.findUnique.mockResolvedValue(null);
    expect(await handleMerchantWebhook({ token: TOKEN, rawBody: body, signature: sign(body, ts), timestamp: ts })).toBe("unauthorized");
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    expect(await handleMerchantWebhook({ token: TOKEN, rawBody: body, signature: sign(body, ts, "faux"), timestamp: ts })).toBe("unauthorized");
    expect(await handleMerchantWebhook({ token: "court", rawBody: body, signature: sign(body, ts), timestamp: ts })).toBe("unauthorized");
    expect(db.paymentRequest.findUnique).not.toHaveBeenCalled();
  });

  it("signature valide : statut relu chez GeniusPay, demande d'une autre organisation ignorée", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ data: { status: "completed" } }));
    vi.stubGlobal("fetch", fetchMock);
    db.paymentSettings.findUnique.mockResolvedValue(settingsRow);
    db.paymentRequest.findUnique.mockResolvedValue({ id: "pr3", organizationId: "org-autre", status: "pending", reference: "GP-3" });
    expect(await handleMerchantWebhook({ token: TOKEN, rawBody: body, signature: sign(body, ts), timestamp: ts })).toBe("ok");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.paymentRequest.updateMany).not.toHaveBeenCalled();

    db.paymentRequest.findUnique.mockResolvedValue({ id: "pr3", organizationId: "org1", status: "pending", reference: "GP-3", amount: 5000, currency: "XOF", reason: "x", createdAt: new Date() });
    db.paymentRequest.updateMany.mockResolvedValue({ count: 1 });
    expect(await handleMerchantWebhook({ token: TOKEN, rawBody: body, signature: sign(body, ts), timestamp: ts })).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/payments/GP-3");
    expect(db.paymentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }));
  });
});
