import { describe, expect, it } from "vitest";
import {
  afterCallbackAttempt,
  callbackGreeting,
  callbackRefusal,
  callbackSettings,
  CALLBACK_MAX_ATTEMPTS,
  CALLBACK_ORG_HOURLY_CAP,
  CALLBACK_RETRY_MS,
} from "@/lib/callbacks/settings";

const on = callbackSettings({ enabled: true });
const base = { cfg: on, reason: "missed" as const, phone: "+22997000000", destinationOpen: true, sentToday: 0, sentThisHour: 0 };

describe("rappel des bips : réglages", () => {
  it("désactivé par défaut, valeurs bornées", () => {
    expect(callbackSettings(undefined).enabled).toBe(false);
    const s = callbackSettings({ enabled: true, mode: "flash", delaySec: 1, maxPerDay: 99 });
    expect(s).toMatchObject({ enabled: true, mode: "flash", delaySec: 10, maxPerDay: 5 });
    expect(callbackSettings({ mode: "autre" as never }).mode).toBe("missed");
  });

  it("phrase de rappel : variables remplacées, phrase par défaut si vide", () => {
    expect(callbackGreeting(on, "Awa", "Pharmacie du Port")).toContain("Awa de Pharmacie du Port");
    expect(callbackGreeting({ ...on, message: "Ici {agent}, {organisation}." }, "Awa", "")).toBe("Ici Awa, notre équipe.");
  });
});

describe("rappel des bips : garde-fous", () => {
  it("rappelle un appel manqué valide", () => {
    expect(callbackRefusal(base)).toBeNull();
  });

  it("refuse si désactivé, numéro masqué ou pays non couvert", () => {
    expect(callbackRefusal({ ...base, cfg: callbackSettings({}) })).toBe("disabled");
    expect(callbackRefusal({ ...base, phone: null })).toBe("number");
    expect(callbackRefusal({ ...base, phone: "inconnu" })).toBe("number");
    expect(callbackRefusal({ ...base, destinationOpen: false })).toBe("destination");
  });

  it("un bip non décroché n'est rappelé qu'en mode « bip »", () => {
    expect(callbackRefusal({ ...base, reason: "flash" })).toBe("mode");
    expect(callbackRefusal({ ...base, reason: "flash", cfg: { ...on, mode: "flash" } })).toBeNull();
    // Un appel manqué se rappelle aussi en mode « bip ».
    expect(callbackRefusal({ ...base, cfg: { ...on, mode: "flash" } })).toBeNull();
  });

  it("plafonds : par numéro sur 24 h et par organisation sur 1 h", () => {
    expect(callbackRefusal({ ...base, sentToday: on.maxPerDay })).toBe("daily_limit");
    expect(callbackRefusal({ ...base, sentThisHour: CALLBACK_ORG_HOURLY_CAP })).toBe("org_limit");
  });
});

describe("rappel des bips : issue d'une tentative", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  it("sans réponse : une relance 5 min plus tard, puis abandon", () => {
    expect(afterCallbackAttempt("no_answer", 1, now)).toEqual({ status: "pending", dueAt: new Date(now.getTime() + CALLBACK_RETRY_MS) });
    expect(afterCallbackAttempt("no_answer", CALLBACK_MAX_ATTEMPTS, now)).toEqual({ status: "no_answer", dueAt: null });
  });
  it("message laissé sur répondeur, échec ou conversation : pas de relance", () => {
    expect(afterCallbackAttempt("no_answer", 1, now, { retry: false })).toEqual({ status: "no_answer", dueAt: null });
    expect(afterCallbackAttempt("failed", 1, now).dueAt).toBeNull();
    expect(afterCallbackAttempt("completed", 1, now).status).toBe("completed");
  });
});
