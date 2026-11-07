/**
 * Règles pures de l'encaissement pendant l'appel (sans base ni réseau) :
 * montants, tarifs de l'entreprise, plafonds, clé d'idempotence.
 * Serveur uniquement (module crypto). Testé unitairement.
 */
import { createHash } from "crypto";
import { EUR_TO_XOF, MIN_XOF } from "./geniuspay";

export type PayCurrency = "XOF" | "EUR";

export interface PriceItem {
  label: string;
  amount: number;
}

export interface PaymentRules {
  currency: PayCurrency;
  /** Plafond par demande, dans `currency`. */
  maxAmount: number;
  allowCustomAmount: boolean;
  items: PriceItem[];
}

/** Plafond absolu, quel que soit le réglage (≈ 3 050 €). */
export const HARD_MAX_XOF = 2_000_000;
/** Au plus quelques demandes de paiement par appel. */
export const MAX_REQUESTS_PER_CALL = 3;
export const MAX_ITEMS = 30;

export function asCurrency(v: unknown): PayCurrency {
  return v === "EUR" ? "EUR" : "XOF";
}

/** Montant en FCFA réellement encaissé, ou null si le montant est invalide. */
export function toXof(amount: number, currency: PayCurrency): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (currency === "XOF") {
    if (!Number.isInteger(amount)) return null;
    return amount;
  }
  // Euros : au centime près.
  if (Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) return null;
  return Math.round(amount * EUR_TO_XOF);
}

/** Plafond effectif en FCFA (réglage de l'entreprise borné par le plafond absolu). */
export function maxXof(rules: Pick<PaymentRules, "currency" | "maxAmount">): number {
  const own = toXof(rules.maxAmount, rules.currency) ?? 0;
  return Math.min(own, HARD_MAX_XOF);
}

/** Plafond effectif exprimé dans la devise de l'entreprise. */
export function maxInCurrency(rules: Pick<PaymentRules, "currency" | "maxAmount">): number {
  const x = maxXof(rules);
  return rules.currency === "XOF" ? x : Math.floor((x / EUR_TO_XOF) * 100) / 100;
}

export function formatAmount(amount: number, currency: PayCurrency): string {
  if (currency === "EUR") {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })} €`;
  }
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`.replace(/ /g, " ");
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Lit les tarifs enregistrés (JSON) en ignorant les lignes invalides. */
export function parseItems(raw: string | null | undefined): PriceItem[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((i) => i && typeof i.label === "string" && i.label.trim() && typeof i.amount === "number" && i.amount > 0)
      .slice(0, MAX_ITEMS)
      .map((i) => ({ label: String(i.label).trim().slice(0, 80), amount: i.amount }));
  } catch {
    return [];
  }
}

/** Retrouve un tarif par son libellé (exact, sinon correspondance unique partielle). */
export function findItem(items: PriceItem[], label: string): PriceItem | null {
  const q = norm(label);
  if (!q) return null;
  const exact = items.find((i) => norm(i.label) === q);
  if (exact) return exact;
  const partial = items.filter((i) => norm(i.label).includes(q) || q.includes(norm(i.label)));
  return partial.length === 1 ? partial[0] : null;
}

function catalogText(rules: PaymentRules): string {
  return rules.items.map((i) => `${i.label} : ${formatAmount(i.amount, rules.currency)}`).join(" ; ");
}

export type ResolvedAmount =
  | { ok: true; amount: number; amountXof: number; item?: string }
  | { ok: false; message: string };

/**
 * Détermine le montant à encaisser à partir des arguments de l'agent :
 * un tarif de l'entreprise (`item`) ou, si autorisé, un montant libre.
 * Applique le minimum GeniusPay et les plafonds.
 */
export function resolvePaymentAmount(args: { amount?: unknown; item?: unknown }, rules: PaymentRules): ResolvedAmount {
  const itemLabel = typeof args.item === "string" ? args.item.slice(0, 120) : "";
  let amount: number | null = null;
  let item: string | undefined;

  if (itemLabel.trim()) {
    const found = findItem(rules.items, itemLabel);
    if (!found) {
      return {
        ok: false,
        message: rules.items.length
          ? `Prestation « ${itemLabel.trim()} » introuvable. Tarifs de l'entreprise : ${catalogText(rules)}.`
          : "Aucun tarif n'est enregistré par l'entreprise.",
      };
    }
    amount = found.amount;
    item = found.label;
  } else if (args.amount !== undefined && args.amount !== null && args.amount !== "") {
    if (!rules.allowCustomAmount) {
      return {
        ok: false,
        message: rules.items.length
          ? `Montant libre non autorisé : utilise un tarif de l'entreprise (${catalogText(rules)}).`
          : "Montant libre non autorisé et aucun tarif enregistré : propose de prendre un message.",
      };
    }
    const n = typeof args.amount === "number" ? args.amount : Number(String(args.amount).replace(/\s/g, "").replace(",", "."));
    amount = Number.isFinite(n) ? n : null;
  } else {
    return {
      ok: false,
      message: rules.items.length
        ? `Précise la prestation (item) ou le montant. Tarifs de l'entreprise : ${catalogText(rules)}.`
        : "Précise le montant à encaisser.",
    };
  }

  const amountXof = amount === null ? null : toXof(amount, rules.currency);
  if (amount === null || amountXof === null) {
    return { ok: false, message: rules.currency === "XOF" ? "Montant invalide (nombre entier de FCFA attendu)." : "Montant invalide." };
  }
  if (amountXof < MIN_XOF) {
    return { ok: false, message: `Montant trop faible : minimum ${formatAmount(MIN_XOF, "XOF")}.` };
  }
  if (amountXof > maxXof(rules)) {
    return {
      ok: false,
      message: `Montant supérieur au plafond autorisé (${formatAmount(maxInCurrency(rules), rules.currency)}) : propose de prendre un message pour l'équipe.`,
    };
  }
  return { ok: true, amount, amountXof, item };
}

/**
 * Clé d'idempotence : un même appel ne crée qu'une demande pour un même
 * montant et un même motif (relance du LLM, double appel d'outil…).
 */
export function paymentIdempotencyKey(organizationId: string, callRef: string, amountXof: number, reason: string): string {
  return createHash("sha256").update(`${organizationId}|${callRef}|${amountXof}|${norm(reason)}`).digest("hex");
}

/** Statut GeniusPay → statut de la demande. */
export function paymentStatusFrom(status: string | null): "completed" | "failed" | "pending" {
  if (status === "completed" || status === "success" || status === "paid") return "completed";
  if (status === "failed" || status === "cancelled" || status === "expired") return "failed";
  return "pending";
}

/**
 * Tarifs saisis en texte, une ligne par prestation : « Consultation = 5000 »
 * (séparateurs acceptés : =, :, ;). Renvoie une erreur lisible sinon.
 */
export function parseItemLines(text: string, currency: PayCurrency): { items: PriceItem[] } | { error: string } {
  const items: PriceItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_ITEMS) return { error: `${MAX_ITEMS} tarifs au maximum.` };
  for (const line of lines) {
    const m = /^(.+?)\s*[=:;]\s*([\d\s.,\u202f\u00a0]+)\s*(?:fcfa|xof|f|€|eur)?$/i.exec(line);
    const label = m?.[1].trim().slice(0, 80);
    const digits = m ? m[2].replace(/[\s\u202f\u00a0]/g, "") : "";
    // FCFA : points = s\u00e9parateurs de milliers (5.000) ; euros : virgule d\u00e9cimale.
    const amount = !m ? NaN : currency === "XOF" ? Number(digits.replace(/\./g, "")) : Number(digits.replace(",", "."));
    if (!label || toXof(amount, currency) === null) {
      return { error: `Ligne invalide : « ${line.slice(0, 60)} ». Format attendu : Prestation = montant.` };
    }
    if (items.some((i) => norm(i.label) === norm(label))) return { error: `Tarif en double : « ${label} ».` };
    items.push({ label, amount });
  }
  return { items };
}
