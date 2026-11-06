/**
 * Informations légales de la société qui émet les factures (réglées dans
 * l'espace administrateur) et TVA. Les valeurs d'environnement INVOICE_SELLER_*
 * servent de point de départ tant que rien n'est enregistré.
 */
import { z } from "zod";
import { prisma } from "../db/client";

export const companySchema = z.object({
  legalName: z.string().trim().min(2, "Raison sociale requise.").max(120),
  legalForm: z.string().trim().max(60).default(""),
  capital: z.string().trim().max(60).default(""),
  address: z.string().trim().max(400).default(""),
  country: z.string().trim().max(60).default(""),
  taxId: z.string().trim().max(60).default(""),
  rccm: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(120).default(""),
  /** "none" = TVA non facturée (mention ci-dessous) ; "vat" = TVA ajoutée au prix HT. */
  vatRegime: z.enum(["none", "vat"]).default("none"),
  vatRate: z.number().min(0).max(30).default(18),
  vatNote: z.string().trim().max(200).default("TVA non applicable"),
  footer: z.string().trim().max(300).default(""),
});

export type Company = z.infer<typeof companySchema>;

const KEY = "company";

function fromEnv(): Company {
  return companySchema.parse({
    legalName: process.env.INVOICE_SELLER_NAME || "Callpme",
    address: process.env.INVOICE_SELLER_ADDRESS || "",
    taxId: process.env.INVOICE_SELLER_TAX_ID || "",
    email: process.env.INVOICE_SELLER_EMAIL || process.env.CONTACT_TO || "",
  });
}

export async function getCompany(): Promise<Company> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!row) return fromEnv();
  try {
    const parsed = companySchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : fromEnv();
  } catch {
    return fromEnv();
  }
}

export async function saveCompany(c: Company) {
  await prisma.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(c) }, update: { value: JSON.stringify(c) } });
}

/** Informations minimales pour une facture conforme. */
export function companyComplete(c: Company): boolean {
  return Boolean(c.legalName && c.address && c.taxId && c.rccm);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Prix HT → montant à payer (TTC si la TVA s'applique). */
export function priceWithVat(amountHt: number, c: Pick<Company, "vatRegime" | "vatRate">): { ht: number; vat: number; ttc: number; rate: number } {
  const rate = c.vatRegime === "vat" ? c.vatRate : 0;
  const vat = round2((amountHt * rate) / 100);
  return { ht: round2(amountHt), vat, ttc: round2(amountHt + vat), rate };
}

/** Instantané figé sur la facture au moment de son émission. */
export interface InvoiceSnapshot {
  seller: Company;
  buyer: { name: string; address: string; taxId: string; country: string };
  ht: number;
  vat: number;
  ttc: number;
  rate: number;
}
