import { describe, expect, it } from "vitest";
import { toE164 } from "@/lib/telephony/e164";
import { COUNTRIES, getCountry } from "@/lib/geo/countries";

describe("numéros selon le pays de l'organisation", () => {
  it("Bénin : nouveaux numéros à 10 chiffres (01…) et anciens à 8 chiffres", () => {
    expect(toE164("01 97 12 34 56", "BJ")).toBe("+2290197123456");
    expect(toE164("97 12 34 56", "BJ")).toBe("+2290197123456");
    expect(toE164("+229 01 97 12 34 56", "BJ")).toBe("+2290197123456");
  });

  it("le même numéro national est français pour une organisation française", () => {
    expect(toE164("01 97 12 34 56", "FR")).toBe("+33197123456");
    expect(toE164("06 12 34 56 78")).toBe("+33612345678");
  });

  it("autres pays d'Afrique de l'Ouest et centrale", () => {
    expect(toE164("07 07 12 34 56", "CI")).toBe("+2250707123456");
    expect(toE164("77 123 45 67", "SN")).toBe("+221771234567");
    expect(toE164("6 77 12 34 56", "CM")).toBe("+237677123456");
    expect(toE164("90 12 34 56", "TG")).toBe("+22890123456");
  });

  it("l'indicatif saisi l'emporte toujours sur le pays", () => {
    expect(toE164("00225 07 07 12 34 56", "BJ")).toBe("+2250707123456");
    expect(toE164("+33 6 12 34 56 78", "BJ")).toBe("+33612345678");
  });

  it("chaque pays a un fuseau horaire et un indicatif ; pays inconnu → France", () => {
    for (const c of COUNTRIES) {
      expect(c.timezone).toMatch(/^[A-Za-z]+\/[A-Za-z_-]+$/);
      expect(c.dial).toMatch(/^\d{1,3}$/);
    }
    expect(getCountry("BJ").timezone).toBe("Africa/Porto-Novo");
    expect(getCountry("XX").code).toBe("FR");
  });
});
