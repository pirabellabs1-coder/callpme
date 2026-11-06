import { describe, expect, it } from "vitest";
import { alertIdFor, DEFAULT_ALERTS, parseAlertSettings } from "@/lib/alerts/settings";

describe("alertes au propriétaire", () => {
  it("relie chaque événement à son réglage", () => {
    expect(alertIdFor("lead.created")).toBe("lead");
    expect(alertIdFor("appointment.cancelled")).toBe("appointment");
    expect(alertIdFor("call.transferred")).toBe("transfer");
    expect(alertIdFor("call.completed")).toBe("call");
    expect(alertIdFor("agent.updated")).toBeNull();
  });

  it("réglages par défaut : messages, rendez-vous et transferts, sans chaque appel", () => {
    expect(parseAlertSettings(null)).toEqual(DEFAULT_ALERTS);
    expect(DEFAULT_ALERTS.events).not.toContain("call");
    expect(parseAlertSettings("pas du json")).toEqual(DEFAULT_ALERTS);
  });

  it("refuse une adresse invalide et garde un réglage valide", () => {
    expect(parseAlertSettings(JSON.stringify({ email: true, events: ["lead"], recipients: ["pas-un-mail"] }))).toEqual(DEFAULT_ALERTS);
    expect(parseAlertSettings(JSON.stringify({ email: false, events: [], recipients: ["Awa@Cabinet.BJ"] }))).toEqual({
      email: false,
      events: [],
      recipients: ["awa@cabinet.bj"],
    });
  });
});
