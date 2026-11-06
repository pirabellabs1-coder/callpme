import { describe, expect, it } from "vitest";
import { addDaysYmd, isYmd, zonedDayStart, zonedParts } from "@/lib/db/calls";

describe("dates à l'heure de Paris", () => {
  it("minuit à Paris en hiver (UTC+1) et en été (UTC+2)", () => {
    expect(zonedDayStart("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(zonedDayStart("2026-07-15").toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("jours de changement d'heure", () => {
    // 29 mars 2026 : passage à l'heure d'été (minuit encore en UTC+1).
    expect(zonedDayStart("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // 25 octobre 2026 : retour à l'heure d'hiver (minuit encore en UTC+2).
    expect(zonedDayStart("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("zonedParts donne la date calendaire de Paris", () => {
    // 23:30 UTC le 5 novembre = 00:30 le 6 novembre à Paris.
    expect(zonedParts(new Date("2026-11-05T23:30:00Z")).ymd).toBe("2026-11-06");
  });

  it("isYmd rejette les formats et dates impossibles", () => {
    expect(isYmd("2026-11-06")).toBe(true);
    expect(isYmd("2026-02-31")).toBe(false);
    expect(isYmd("06/11/2026")).toBe(false);
    expect(isYmd("")).toBe(false);
    expect(isYmd(null)).toBe(false);
  });

  it("addDaysYmd traverse les mois et années", () => {
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
  });
});
