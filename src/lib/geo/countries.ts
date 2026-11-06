/**
 * Pays couverts : indicatif, fuseau horaire et format des numéros nationaux.
 * Module pur (client et serveur). Le pays de l'organisation sert de pays par
 * défaut pour les numéros saisis sans indicatif.
 */
export interface CountryInfo {
  code: string;
  name: string;
  dial: string;
  timezone: string;
  /** Chiffres nationaux → numéro E.164 (sans le « + »), ou null si le format ne correspond pas. */
  national: (digits: string) => string | null;
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: "BJ",
    name: "Bénin",
    dial: "229",
    timezone: "Africa/Porto-Novo",
    // Depuis fin 2024 : 10 chiffres commençant par 01. Les anciens numéros à 8 chiffres reçoivent « 01 ».
    national: (d) => (/^01\d{8}$/.test(d) ? `229${d}` : /^\d{8}$/.test(d) ? `22901${d}` : null),
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    dial: "225",
    timezone: "Africa/Abidjan",
    national: (d) => (/^0\d{9}$/.test(d) ? `225${d}` : null),
  },
  {
    code: "SN",
    name: "Sénégal",
    dial: "221",
    timezone: "Africa/Dakar",
    national: (d) => (/^[37]\d{8}$/.test(d) ? `221${d}` : null),
  },
  {
    code: "CM",
    name: "Cameroun",
    dial: "237",
    timezone: "Africa/Douala",
    national: (d) => (/^[26]\d{8}$/.test(d) ? `237${d}` : null),
  },
  {
    code: "TG",
    name: "Togo",
    dial: "228",
    timezone: "Africa/Lome",
    national: (d) => (/^\d{8}$/.test(d) ? `228${d}` : null),
  },
  {
    code: "ML",
    name: "Mali",
    dial: "223",
    timezone: "Africa/Bamako",
    national: (d) => (/^\d{8}$/.test(d) ? `223${d}` : null),
  },
  {
    code: "FR",
    name: "France",
    dial: "33",
    timezone: "Europe/Paris",
    national: (d) => (/^0[1-9]\d{8}$/.test(d) ? `33${d.slice(1)}` : null),
  },
  {
    code: "BE",
    name: "Belgique",
    dial: "32",
    timezone: "Europe/Brussels",
    national: (d) => (/^0\d{8,9}$/.test(d) ? `32${d.slice(1)}` : null),
  },
  {
    code: "CH",
    name: "Suisse",
    dial: "41",
    timezone: "Europe/Zurich",
    national: (d) => (/^0\d{9}$/.test(d) ? `41${d.slice(1)}` : null),
  },
  {
    code: "CA",
    name: "Canada",
    dial: "1",
    timezone: "America/Toronto",
    national: (d) => (/^[2-9]\d{9}$/.test(d) ? `1${d}` : /^1[2-9]\d{9}$/.test(d) ? d : null),
  },
];

export const DEFAULT_COUNTRY = "FR";

export function getCountry(code: string | null | undefined): CountryInfo {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)!;
}

export function isCountryCode(code: string): boolean {
  return COUNTRIES.some((c) => c.code === code);
}
