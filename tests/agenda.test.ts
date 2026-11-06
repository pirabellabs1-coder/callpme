import { describe, expect, it } from "vitest";
import { normalizeHm, utcToZoned, zonedToUtc, isYmd, spokenDateTime } from "@/lib/agenda/time";
import { bookingConfig, freeSlots, withinOpeningHours } from "@/lib/agenda/slots";
import { scoreLead } from "@/lib/leads/service";

describe("fuseaux horaires", () => {
  it("convertit une heure locale de Paris en UTC (hiver et été)", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "Europe/Paris").toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToUtc("2026-07-15", "09:00", "Europe/Paris").toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("gère Abidjan (UTC) et Montréal", () => {
    expect(zonedToUtc("2026-03-02", "10:30", "Africa/Abidjan").toISOString()).toBe("2026-03-02T10:30:00.000Z");
    expect(zonedToUtc("2026-03-02", "10:30", "America/Toronto").toISOString()).toBe("2026-03-02T15:30:00.000Z");
  });

  it("fait l'aller-retour UTC -> local", () => {
    const d = zonedToUtc("2026-10-25", "14:15", "Europe/Paris"); // jour du changement d'heure
    expect(utcToZoned(d, "Europe/Paris")).toMatchObject({ ymd: "2026-10-25", hm: "14:15", weekday: 0 });
  });

  it("lit les heures dites à l'oral et valide les dates", () => {
    expect(normalizeHm("14h30")).toBe("14:30");
    expect(normalizeHm("9h")).toBe("09:00");
    expect(normalizeHm("25:00")).toBeNull();
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("2026-02-28")).toBe(true);
  });

  it("formule la date à l'oral", () => {
    expect(spokenDateTime(zonedToUtc("2026-11-12", "16:30", "Europe/Paris"), "Europe/Paris")).toBe("jeudi 12 novembre à 16 h 30");
  });
});

describe("créneaux libres", () => {
  const cfg = bookingConfig({ durationMin: 30, minNoticeMin: 60 });
  const now = new Date("2026-11-09T06:00:00Z"); // lundi 7 h à Paris

  it("découpe les horaires d'ouverture en créneaux", () => {
    const slots = freeSlots({ ymd: "2026-11-10", config: cfg, busy: [], now });
    expect(slots[0].hm).toBe("09:00");
    expect(slots).toHaveLength(14); // 6 le matin + 8 l'après-midi
  });

  it("exclut les créneaux occupés et le délai minimal", () => {
    const busy = [{ start: zonedToUtc("2026-11-09", "09:00", "Europe/Paris"), end: zonedToUtc("2026-11-09", "10:00", "Europe/Paris") }];
    const nowLate = new Date("2026-11-09T07:45:00Z"); // 8 h 45 : rien avant 9 h 45
    const hms = freeSlots({ ymd: "2026-11-09", config: cfg, busy, now: nowLate }).map((s) => s.hm);
    expect(hms).not.toContain("09:00");
    expect(hms).not.toContain("09:30");
    expect(hms[0]).toBe("10:00");
  });

  it("filtre par moment de la journée", () => {
    const hms = freeSlots({ ymd: "2026-11-10", config: cfg, busy: [], now, partOfDay: "apres-midi" }).map((s) => s.hm);
    expect(hms.every((h) => h >= "12:00")).toBe(true);
  });

  it("est fermé le week-end par défaut", () => {
    expect(freeSlots({ ymd: "2026-11-14", config: cfg, busy: [], now })).toHaveLength(0);
    expect(withinOpeningHours("2026-11-14", "10:00", cfg)).toBe(false);
    expect(withinOpeningHours("2026-11-10", "11:45", cfg)).toBe(false); // déborde de midi
    expect(withinOpeningHours("2026-11-10", "11:30", cfg)).toBe(true);
  });
});

describe("qualification des prospects", () => {
  it("donne un score explicable", () => {
    expect(scoreLead({ need: "site e-commerce", budget: "5 000 €", timeline: "ce mois-ci" })).toBe(100);
    expect(scoreLead({ need: "renseignement" })).toBe(40);
  });
});

import { bookingSchema } from "@/lib/validation/agent";
import { DEFAULT_BOOKING } from "@/lib/agenda/slots";
import { containsLink } from "@/lib/security/daily-quota";
import { checkDestination } from "@/lib/telephony/destinations";

describe("réglages d'agenda (validation)", () => {
  it("accepte les réglages par défaut et des jours fermés", () => {
    expect(bookingSchema.safeParse(DEFAULT_BOOKING).success).toBe(true);
    const closedWednesday = { ...DEFAULT_BOOKING, hours: { ...DEFAULT_BOOKING.hours } };
    delete closedWednesday.hours["3"];
    expect(bookingSchema.safeParse(closedWednesday).success).toBe(true);
  });
  it("refuse une plage inversée ou un fuseau inconnu", () => {
    expect(bookingSchema.safeParse({ ...DEFAULT_BOOKING, hours: { "1": [["18:00", "09:00"]] } }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...DEFAULT_BOOKING, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("garde-fous des actions", () => {
  it("détecte les liens dans un SMS ou un e-mail dicté", () => {
    expect(containsLink("Payez sur http://exemple.test")).toBe(true);
    expect(containsLink("rendez-vous sur paiement-rapide.com")).toBe(true);
    expect(containsLink("Votre rendez-vous est mardi à 10 h, référence RDV-2K9PQ.")).toBe(false);
  });
  it("bloque les indicatifs +1 des Caraïbes mais garde les États-Unis et le Canada", () => {
    expect(checkDestination("+1 876 555 0101").ok).toBe(false);
    expect(checkDestination("+1 514 555 0101").ok).toBe(true);
  });
});
