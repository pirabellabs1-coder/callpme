import { describe, expect, it } from "vitest";
import { applyPromo, extendPaidUntil, subscriptionState, TRIAL_MINUTES } from "@/lib/billing/subscription";

const DAY = 86_400_000;
const now = new Date("2026-11-06T12:00:00Z");

describe("abonnement", () => {
  it("essai gratuit à l'inscription : 14 jours, minutes limitées, limites Starter", () => {
    const s = subscriptionState({ plan: "starter", createdAt: new Date(now.getTime() - 3 * DAY), paidUntil: null, trialEndsAt: null }, now);
    expect(s.status).toBe("trial");
    expect(s.minutesIncluded).toBe(TRIAL_MINUTES);
    expect(s.plan.id).toBe("starter");
    expect(s.daysLeft).toBe(11);
  });

  it("essai terminé sans paiement : expiré, plus de minutes", () => {
    const s = subscriptionState({ plan: "starter", createdAt: new Date(now.getTime() - 20 * DAY), paidUntil: null, trialEndsAt: null }, now);
    expect(s.status).toBe("expired");
    expect(s.minutesIncluded).toBe(0);
  });

  it("période payée : minutes de l'offre, décompte depuis le début de la période", () => {
    const paidUntil = new Date(now.getTime() + 10 * DAY);
    const s = subscriptionState({ plan: "pro", createdAt: new Date(now.getTime() - 90 * DAY), paidUntil, trialEndsAt: null }, now);
    expect(s.status).toBe("active");
    expect(s.minutesIncluded).toBe(3000);
    expect(s.periodStart.getTime()).toBe(paidUntil.getTime() - 30 * DAY);
  });

  it("une offre payée puis échue n'a pas de nouvel essai", () => {
    const s = subscriptionState({ plan: "pro", createdAt: new Date(now.getTime() - 2 * DAY), paidUntil: new Date(now.getTime() - DAY), trialEndsAt: null }, now);
    expect(s.status).toBe("expired");
  });

  it("renouvellement : les jours s'ajoutent ; changement d'offre : repart d'aujourd'hui", () => {
    const running = { plan: "starter", paidUntil: new Date(now.getTime() + 5 * DAY) };
    expect(extendPaidUntil(running, "starter", now).getTime()).toBe(now.getTime() + 35 * DAY);
    expect(extendPaidUntil(running, "pro", now).getTime()).toBe(now.getTime() + 30 * DAY);
    expect(extendPaidUntil({ plan: "starter", paidUntil: null }, "starter", now).getTime()).toBe(now.getTime() + 30 * DAY);
  });

  it("codes promo", () => {
    expect(applyPromo(49, { discountType: "percent", discountValue: 20 })).toBe(39);
    expect(applyPromo(49, { discountType: "percent", discountValue: 150 })).toBe(0);
    expect(applyPromo(49, { discountType: "amount", discountValue: 60 })).toBe(0);
    expect(applyPromo(49, { discountType: "plan", discountValue: 0 })).toBe(49);
  });
});
