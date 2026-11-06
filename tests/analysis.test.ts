import { describe, expect, it } from "vitest";
import { coerceExtracted, describeFields, fieldKey, formatValue, type ExtractField } from "@/lib/analysis/fields";
import { configSchema } from "@/lib/validation/agent";

const fields: ExtractField[] = [
  { key: "budget", label: "Budget", type: "number" },
  { key: "rappel", label: "Rappel souhaité", type: "boolean" },
  { key: "urgence", label: "Urgence", type: "choice", options: ["faible", "haute"] },
  { key: "date_souhaitee", label: "Date souhaitée", type: "date" },
  { key: "motif", label: "Motif", type: "text" },
];

describe("données relevées en fin d'appel", () => {
  it("convertit les valeurs selon le type déclaré", () => {
    expect(
      coerceExtracted(fields, { budget: "1 500,50 €", rappel: "oui", urgence: "Haute", date_souhaitee: "2026-11-12", motif: "  Devis\\n toiture " }),
    ).toEqual({ budget: 1500.5, rappel: true, urgence: "haute", date_souhaitee: "2026-11-12", motif: "Devis\\n toiture" });
  });

  it("préfère « non renseigné » à une valeur fausse ou inventée", () => {
    expect(coerceExtracted(fields, { budget: "beaucoup", rappel: "peut-être", urgence: "critique", date_souhaitee: "2026-02-31", autre: "x" })).toEqual({
      budget: null,
      rappel: null,
      urgence: null,
      date_souhaitee: null,
      motif: null,
    });
    expect(coerceExtracted(fields, "pas un objet")).toMatchObject({ budget: null });
  });

  it("décrit le schéma pour l'IA et produit des clés sûres", () => {
    expect(describeFields(fields)).toContain('"urgence" (une valeur parmi : "faible", "haute")');
    expect(fieldKey("Date souhaitée !")).toBe("date_souhaitee");
    expect(formatValue(true)).toBe("Oui");
    expect(formatValue(null)).toBe("—");
  });

  it("valide la configuration d'analyse d'un agent", () => {
    const ok = configSchema.shape.analysis.safeParse({ fields, successCriteria: "Rendez-vous pris" });
    expect(ok.success).toBe(true);
    const bad = configSchema.shape.analysis.safeParse({ fields: [{ key: "Mauvaise clé", label: "x", type: "text" }] });
    expect(bad.success).toBe(false);
  });
});
