import { describe, expect, it } from "vitest";
import { extraMinutesConsumed, getPack, MINUTE_PACKS } from "@/lib/billing/topups";

describe("recharges de minutes", () => {
  it("seule la partie de l'appel au-delà de l'offre consomme les recharges", () => {
    expect(extraMinutesConsumed(100, 5, 500)).toBe(0);
    expect(extraMinutesConsumed(498, 5, 500)).toBe(3);
    expect(extraMinutesConsumed(600, 5, 500)).toBe(5);
    expect(extraMinutesConsumed(0, 0, 30)).toBe(0);
  });

  it("le prix à la minute baisse avec la taille de la recharge", () => {
    const perMinute = MINUTE_PACKS.map((p) => p.priceEur / p.minutes);
    expect(perMinute[0]).toBeGreaterThan(perMinute[1]);
    expect(perMinute[1]).toBeGreaterThan(perMinute[2]);
    expect(getPack("m500")?.minutes).toBe(500);
    expect(getPack("inconnu")).toBeUndefined();
  });
});
