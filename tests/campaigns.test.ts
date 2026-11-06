import { describe, expect, it } from "vitest";
import { afterAttempt, campaignSettings, inCallingWindow, nextWindowStart } from "@/lib/campaigns/settings";
import { parseContactsCsv, splitCsvLine } from "@/lib/campaigns/csv";

describe("plages horaires de campagne", () => {
  const s = campaignSettings(null); // semaine, 10–13 h et 14–20 h, Paris

  it("autorise un mardi à 11 h et refuse la pause de midi, le soir et le dimanche", () => {
    expect(inCallingWindow(new Date("2026-11-10T10:00:00Z"), s)).toBe(true); // 11 h Paris
    expect(inCallingWindow(new Date("2026-11-10T12:30:00Z"), s)).toBe(false); // 13 h 30 (pause de midi)
    expect(inCallingWindow(new Date("2026-11-10T19:30:00Z"), s)).toBe(false); // 20 h 30
    expect(inCallingWindow(new Date("2026-11-08T10:00:00Z"), s)).toBe(false); // dimanche
  });

  it("ne démarre pas un appel dans les 5 dernières minutes d'une plage", () => {
    expect(inCallingWindow(new Date("2026-11-10T18:57:00Z"), s)).toBe(false); // 19 h 57
  });

  it("annonce la reprise au prochain créneau", () => {
    const next = nextWindowStart(new Date("2026-11-07T15:00:00Z"), s)!; // samedi
    expect(next.toISOString()).toBe("2026-11-09T09:00:00.000Z"); // lundi 10 h Paris
  });

  it("borne les réglages saisis", () => {
    const x = campaignSettings({ maxConcurrent: 500, maxAttempts: 0, retryDelayMin: 1 });
    expect([x.maxConcurrent, x.maxAttempts, x.retryDelayMin]).toEqual([20, 1, 15]);
  });
});

describe("relances", () => {
  const s = campaignSettings({ maxAttempts: 3, retryDelayMin: 60 });
  const now = new Date("2026-11-10T10:00:00Z");

  it("replanifie une non-réponse tant qu'il reste des tentatives", () => {
    expect(afterAttempt("no_answer", 1, s, now).nextAttemptAt?.toISOString()).toBe("2026-11-10T11:00:00.000Z");
    expect(afterAttempt("voicemail", 2, s, now).nextAttemptAt).not.toBeNull();
    expect(afterAttempt("no_answer", 3, s, now).nextAttemptAt).toBeNull();
  });

  it("ne relance jamais un contact joint", () => {
    expect(afterAttempt("completed", 1, s, now).nextAttemptAt).toBeNull();
  });
});

describe("import CSV", () => {
  it("reconnaît les colonnes et garde les autres comme variables", () => {
    const r = parseContactsCsv("Prénom;Nom;Téléphone;Montant dû\nMarie;Durand;+33 6 12 34 56 78;120 €\nAmadou;Diallo;+221 77 123 45 67;45 000 FCFA");
    expect(r.mapping).toEqual({ phone: "telephone", name: "nom", firstName: "prenom", extra: ["montant_du"] });
    expect(r.valid[0]).toEqual({ name: "Marie Durand", phone: "+33 6 12 34 56 78", data: { prenom: "Marie", montant_du: "120 €" } });
    expect(r.valid).toHaveLength(2);
  });

  it("lit un fichier sans en-tête et écarte doublons et numéros invalides", () => {
    const r = parseContactsCsv("Marie Durand,0612345678\n0612345678,Doublon\nSans numéro,abc", new Set());
    expect(r.valid).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.issues).toHaveLength(1);
  });

  it("respecte les guillemets", () => {
    expect(splitCsvLine('"Dupont; fils";"+33 6 00 00 00 00"', ";")).toEqual(["Dupont; fils", "+33 6 00 00 00 00"]);
  });
});
