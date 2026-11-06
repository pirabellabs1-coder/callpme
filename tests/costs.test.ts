import { afterEach, describe, expect, it, vi } from "vitest";
import { CostMeter, parseCosts } from "@/lib/costs/meter";
import { minuteCostEur, planMargin, project } from "@/lib/costs/economics";
import { anthropicUsage, reportLlmUsage, runWithUsage, type LlmUsage } from "@/lib/llm/usage";

afterEach(() => vi.unstubAllEnvs());

describe("coût réel d'un appel", () => {
  it("additionne tokens, caractères de voix, transcription et téléphonie", () => {
    vi.stubEnv("COST_USD_TO_EUR", "1");
    vi.stubEnv("ELEVENLABS_USD_PER_1K_CHARS", "0.1");
    const m = new CostMeter();
    m.addLlm({ model: "claude-haiku-5-5", input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 1_000_000 });
    m.addTts("x".repeat(1000));
    const c = m.summary({ durationSec: 90, direction: "inbound", to: "+33100000000" });
    expect(c.usd.llm).toBeCloseTo(0.11, 6); // 0,10 $ + 0,01 $ (cache)
    expect(c.usd.tts).toBeCloseTo(0.1, 6);
    expect(c.usd.telephony).toBeCloseTo(2 * 0.0144, 6); // minute entamée facturée
    expect(c.units.ttsChars).toBe(1000);
    expect(parseCosts(JSON.stringify(c))?.eur).toBeCloseTo(c.usd.total, 6);
    expect(parseCosts("pas du json")).toBeNull();
  });

  it("le test au navigateur ne coûte pas de téléphonie ; le Bénin coûte cher", () => {
    const m = new CostMeter();
    expect(m.summary({ durationSec: 60, direction: "web", to: "" }).usd.telephony).toBe(0);
    expect(m.summary({ durationSec: 60, direction: "outbound", to: "+22997000000" }).usd.telephony).toBeGreaterThan(0.6);
  });

  it("relève les tokens des requêtes faites pendant l'appel, et seulement elles", async () => {
    const got: LlmUsage[] = [];
    const u = anthropicUsage("claude-haiku-5-5", { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 })!;
    await runWithUsage((x) => got.push(x), async () => {
      await Promise.resolve();
      reportLlmUsage(u);
    });
    reportLlmUsage(u); // hors portée : ignoré
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ input: 10, output: 5, cacheRead: 100, cacheWrite: 0 });
  });
});

describe("rentabilité", () => {
  it("une minute entrante coûte surtout en voix", () => {
    vi.stubEnv("COST_USD_TO_EUR", "1");
    const m = minuteCostEur();
    expect(m.tts).toBeGreaterThan(m.llm);
    expect(m.total).toBeCloseTo(m.llm + m.tts + m.stt + m.telephony, 9);
    expect(minuteCostEur({ channel: "web" }).telephony).toBe(0);
  });

  it("la marge dépend des minutes réellement utilisées", () => {
    const full = planMargin("pro", 1, 0.07);
    const half = planMargin("pro", 0.5, 0.07);
    expect(full.minutesUsed).toBe(1000);
    expect(half.margin).toBeGreaterThan(full.margin);
    expect(full.margin).toBeGreaterThan(40); // 1 000 minutes à 149 € : rentable même toutes utilisées
  });

  it("le bénéfice tient compte des frais fixes", () => {
    const p = project(10, { proShare: 0.3, usage: 0.5, perMinuteEur: 0.07 });
    expect(p.revenue).toBe(7 * 49 + 3 * 149);
    expect(p.profit).toBeCloseTo(p.revenue - p.variableCosts - p.fixedCosts, 6);
  });
});

describe("appels sortants et marges", () => {
  it("chaque destination garde au moins 50 % de marge, frais de paiement compris", async () => {
    const { OUTBOUND_DESTINATIONS, outboundRateEur } = await import("@/lib/billing/outbound-rates");
    for (const d of OUTBOUND_DESTINATIONS) {
      const price = outboundRateEur(d.sample);
      const cost = minuteCostEur({ channel: "outbound", to: d.sample }).total;
      expect((price * 0.95 - cost) / price).toBeGreaterThanOrEqual(0.45);
      expect((price - cost) / price).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("n'ouvre que les destinations au coût connu, facture la minute entamée", async () => {
    const { outboundDestinationOpen, outboundChargeCents, outboundRateCents, maxSecondsForCredit } = await import("@/lib/billing/outbound-rates");
    expect(outboundDestinationOpen("+22997000000")).toBe(true);
    expect(outboundDestinationOpen("+44 20 7946 0000")).toBe(false);
    const rate = outboundRateCents("+22997000000");
    expect(outboundChargeCents(61, "+22997000000")).toBe(2 * rate);
    expect(outboundChargeCents(0, "+22997000000")).toBe(0);
    expect(maxSecondsForCredit(rate * 3 + 1, "+22997000000")).toBe(180);
  });

  it("chaque abonnement garde au moins 40 % de marge, même toutes les minutes utilisées", () => {
    const per = minuteCostEur().total;
    for (const plan of ["starter", "pro"] as const) {
      const m = planMargin(plan, 1, per);
      expect(m.margin / m.price).toBeGreaterThanOrEqual(0.4);
    }
  });

  it("chaque recharge de minutes garde au moins 40 % de marge", async () => {
    const { MINUTE_PACKS } = await import("@/lib/billing/topups");
    const { geniusPayFeeEur } = await import("@/lib/costs/prices");
    const per = minuteCostEur().total;
    for (const p of MINUTE_PACKS) {
      const margin = p.priceEur - p.minutes * per - geniusPayFeeEur(p.priceEur);
      expect(margin / p.priceEur).toBeGreaterThanOrEqual(0.4);
    }
  });
});

describe("offre d'entrée Essentiel", () => {
  it("19 € pour 100 minutes, au moins 40 % de marge même toutes les minutes utilisées", async () => {
    const { PLANS, PLAN_ORDER } = await import("@/lib/billing/plans");
    expect(PLAN_ORDER[0]).toBe("essentiel");
    expect(PLANS.essentiel).toMatchObject({ priceMonthly: 19, minutes: 100, maxAgents: 1, maxNumbers: 1 });
    const m = planMargin("essentiel", 1, minuteCostEur().total);
    expect(m.margin / m.price).toBeGreaterThanOrEqual(0.4);
  });
});
