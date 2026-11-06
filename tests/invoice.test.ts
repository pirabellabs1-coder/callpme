import { describe, expect, it } from "vitest";
import { companyComplete, companySchema, priceWithVat } from "@/lib/billing/company";

describe("factures : TVA et mentions légales", () => {
  it("sans TVA : le prix payé est le prix affiché", () => {
    expect(priceWithVat(49, { vatRegime: "none", vatRate: 18 })).toEqual({ ht: 49, vat: 0, ttc: 49, rate: 0 });
  });

  it("avec TVA à 18 % : HT + TVA = TTC, arrondi au centime", () => {
    expect(priceWithVat(49, { vatRegime: "vat", vatRate: 18 })).toEqual({ ht: 49, vat: 8.82, ttc: 57.82, rate: 18 });
    const p = priceWithVat(19, { vatRegime: "vat", vatRate: 18 });
    expect(p.ht + p.vat).toBeCloseTo(p.ttc, 9);
  });

  it("une facture conforme exige raison sociale, adresse, IFU et RCCM", () => {
    const base = companySchema.parse({ legalName: "Pirabel Labs" });
    expect(base.vatRegime).toBe("none");
    expect(base.vatNote).toBe("TVA non applicable");
    expect(companyComplete(base)).toBe(false);
    expect(companyComplete({ ...base, address: "Cotonou", taxId: "0202012345678", rccm: "RB/COT/24 B 1234" })).toBe(true);
  });

  it("refuse une raison sociale vide ou un taux de TVA absurde", () => {
    expect(companySchema.safeParse({ legalName: "" }).success).toBe(false);
    expect(companySchema.safeParse({ legalName: "Callpme", vatRate: 80 }).success).toBe(false);
  });
});
