/**
 * Marketplace des numéros — données et règles pures (importables côté navigateur).
 *
 * Les numéros sont fournis par des opérateurs partenaires (MTN, Moov…) et
 * mis en stock par l'équipe Callpme. Le client choisit un numéro (pays,
 * réseau, début du numéro), envoie une demande avec les informations de son
 * entreprise, et l'équipe l'attribue depuis l'espace admin. Quand aucun
 * numéro n'est disponible (ex. pays pas encore couvert), la demande est
 * quand même enregistrée.
 */
import { z } from "zod";

export interface MarketNetwork {
  id: string;
  label: string;
}

export interface MarketCountry {
  code: string; // ISO 3166-1 alpha-2
  label: string;
  dial: string; // indicatif sans « + »
  networks: MarketNetwork[];
}

const n = (id: string, label: string): MarketNetwork => ({ id, label });

/** Pays proposés dans la marketplace (le stock dit ensuite ce qui est disponible). */
export const MARKET_COUNTRIES: MarketCountry[] = [
  { code: "BJ", label: "Bénin", dial: "229", networks: [n("mtn", "MTN"), n("moov", "Moov Africa"), n("celtiis", "Celtiis")] },
  { code: "CI", label: "Côte d'Ivoire", dial: "225", networks: [n("mtn", "MTN"), n("orange", "Orange"), n("moov", "Moov Africa")] },
  { code: "TG", label: "Togo", dial: "228", networks: [n("moov", "Moov Africa"), n("togocom", "Togocom")] },
  { code: "SN", label: "Sénégal", dial: "221", networks: [n("orange", "Orange"), n("free", "Free"), n("expresso", "Expresso")] },
  { code: "BF", label: "Burkina Faso", dial: "226", networks: [n("orange", "Orange"), n("moov", "Moov Africa"), n("telecel", "Telecel")] },
  { code: "ML", label: "Mali", dial: "223", networks: [n("orange", "Orange"), n("moov", "Moov Africa"), n("telecel", "Telecel")] },
  { code: "NE", label: "Niger", dial: "227", networks: [n("airtel", "Airtel"), n("moov", "Moov Africa"), n("zamani", "Zamani")] },
  { code: "GN", label: "Guinée", dial: "224", networks: [n("orange", "Orange"), n("cellcom", "Cellcom")] },
  { code: "CM", label: "Cameroun", dial: "237", networks: [n("mtn", "MTN"), n("orange", "Orange"), n("camtel", "Camtel")] },
  { code: "GH", label: "Ghana", dial: "233", networks: [n("mtn", "MTN"), n("telecel", "Telecel"), n("airteltigo", "AirtelTigo")] },
  { code: "NG", label: "Nigeria", dial: "234", networks: [n("mtn", "MTN"), n("airtel", "Airtel"), n("glo", "Glo"), n("9mobile", "9mobile")] },
];

export const NUMBER_KINDS = [
  { id: "mobile", label: "Mobile" },
  { id: "fixe", label: "Fixe" },
] as const;

export type NumberKind = (typeof NUMBER_KINDS)[number]["id"];

export function marketCountry(code: string | null | undefined): MarketCountry | undefined {
  return MARKET_COUNTRIES.find((c) => c.code === code);
}

export function networkLabel(country: string, network: string | null | undefined): string {
  if (!network) return "Tous réseaux";
  return marketCountry(country)?.networks.find((x) => x.id === network)?.label ?? network;
}

export function isMarketNetwork(country: string, network: string): boolean {
  return !!marketCountry(country)?.networks.some((x) => x.id === network);
}

/** Partie nationale d'un numéro E.164 (sans l'indicatif du pays). */
export function nationalPart(e164: string, country: string): string {
  const dial = marketCountry(country)?.dial ?? "";
  const digits = e164.replace(/\D/g, "");
  return dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits;
}

/** Garde les chiffres d'un préfixe saisi (« 95 », « 01 95 »…), 6 au plus. */
export function cleanPrefix(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 6);
}

/**
 * Le numéro commence-t-il par ce préfixe ? On compare la partie nationale,
 * avec ou sans le « 01 » / « 0 » de tête (au Bénin, « 95 » trouve +229 01 95…).
 */
export function matchesPrefix(e164: string, country: string, prefix: string): boolean {
  const p = cleanPrefix(prefix);
  if (!p) return true;
  const nat = nationalPart(e164, country);
  return [nat, nat.replace(/^01/, ""), nat.replace(/^0/, "")].some((v) => v.startsWith(p));
}

/** Affichage lisible : « +229 01 95 12 34 56 ». */
export function formatMarketNumber(e164: string, country: string): string {
  const dial = marketCountry(country)?.dial;
  const nat = nationalPart(e164, country);
  const pairs = nat.match(/.{1,2}/g)?.join(" ") ?? nat;
  return dial ? `+${dial} ${pairs}` : e164;
}

/** Normalise un numéro saisi par l'admin en E.164 pour ce pays (null si invalide). */
export function toMarketE164(raw: string, country: string): string | null {
  const c = marketCountry(country);
  if (!c) return null;
  let digits = raw.trim().replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else digits = c.dial + digits;
  if (!/^\d+$/.test(digits) || !digits.startsWith(c.dial)) return null;
  const nat = digits.length - c.dial.length;
  if (nat < 7 || nat > 11) return null;
  return `+${digits}`;
}

/** Taux fixe FCFA (XOF/XAF) → euro. */
export const XOF_PER_EUR = 655.957;

export function xofToEur(xof: number): number {
  return Math.round((xof / XOF_PER_EUR) * 100) / 100;
}

export function formatXof(xof: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(xof))} FCFA`;
}

/** Demandes ouvertes (en attente) autorisées par organisation. */
export const MAX_OPEN_REQUESTS = 3;

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Formulaire de demande d'un numéro (côté client). */
export const numberRequestSchema = z
  .object({
    country: z.string().length(2),
    network: optional(20),
    desiredPrefix: optional(12),
    stockId: optional(40),
    companyName: text(120),
    contactName: text(120),
    contactPhone: z.string().trim().min(6).max(30),
    contactEmail: z.string().trim().email().max(160),
    businessId: optional(60),
    taxId: optional(60),
    address: text(240),
    usage: optional(400),
  })
  .refine((v) => !!marketCountry(v.country), { message: "Pays non proposé.", path: ["country"] })
  .refine((v) => !v.network || isMarketNetwork(v.country, v.network), { message: "Réseau inconnu.", path: ["network"] });

export type NumberRequestInput = z.infer<typeof numberRequestSchema>;

/** Ajout de numéros au stock (côté admin) : une liste, mêmes pays/réseau/prix. */
export const stockImportSchema = z
  .object({
    country: z.string().length(2),
    network: z.string().min(1).max(20),
    kind: z.enum(["mobile", "fixe"]),
    monthlyPriceXof: z.number().int().min(0).max(1_000_000),
    setupPriceXof: z.number().int().min(0).max(5_000_000),
    numbers: z.string().min(1).max(20_000),
    note: optional(200),
  })
  .refine((v) => !!marketCountry(v.country), { message: "Pays non proposé.", path: ["country"] })
  .refine((v) => isMarketNetwork(v.country, v.network), { message: "Réseau inconnu.", path: ["network"] });

/** Découpe la liste collée par l'admin : un numéro par ligne, virgule ou point-virgule. */
export function parseStockList(raw: string, country: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const item of raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const e164 = toMarketE164(item, country);
    if (e164) valid.add(e164);
    else invalid.push(item);
  }
  return { valid: Array.from(valid).slice(0, 500), invalid: invalid.slice(0, 50) };
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "En cours d'examen",
  approved: "Attribué",
  rejected: "Refusé",
  cancelled: "Annulé",
};
