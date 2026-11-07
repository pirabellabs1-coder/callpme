/**
 * Pays où Callpme vend des numéros — données pures, importables côté navigateur
 * (le module numbers.ts, lui, tire la téléphonie serveur).
 */
export interface NumberCountry {
  code: string;
  label: string;
  /** Prix mensuel indicatif facturé au client, en euros. */
  monthlyEur: number;
  types: ("local" | "mobile" | "tollfree")[];
}

/** Pays proposés (marchés de Callpme). Prix indicatifs, à ajuster selon l'opérateur. */
export const NUMBER_COUNTRIES: NumberCountry[] = [
  { code: "FR", label: "France", monthlyEur: 3, types: ["local", "mobile"] },
  { code: "BE", label: "Belgique", monthlyEur: 3, types: ["local", "mobile"] },
  { code: "CH", label: "Suisse", monthlyEur: 5, types: ["local"] },
  { code: "CA", label: "Canada (Québec)", monthlyEur: 2, types: ["local", "tollfree"] },
  { code: "US", label: "États-Unis", monthlyEur: 2, types: ["local", "tollfree"] },
  { code: "CI", label: "Côte d'Ivoire", monthlyEur: 15, types: ["local"] },
  { code: "SN", label: "Sénégal", monthlyEur: 15, types: ["local"] },
];

export function countryInfo(code: string): NumberCountry | undefined {
  return NUMBER_COUNTRIES.find((c) => c.code === code);
}

/** Pays proposé correspondant à un numéro E.164 (null si hors liste). */
export function countryOfNumber(e164: string): NumberCountry | null {
  const DIAL: [string, string][] = [
    ["+225", "CI"],
    ["+221", "SN"],
    ["+33", "FR"],
    ["+32", "BE"],
    ["+41", "CH"],
    ["+1", "US"],
  ];
  const code = DIAL.find(([d]) => e164.startsWith(d))?.[1];
  return code ? countryInfo(code) ?? null : null;
}
