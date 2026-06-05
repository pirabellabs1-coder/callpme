/**
 * Client GeniusPay (pay.genius.ci) — mode Checkout.
 * On affiche les prix en EUR sur le site ; GeniusPay facture en FCFA (XOF)
 * avec la parité fixe du franc CFA. Secret jamais exposé au client.
 */
const API = "https://pay.genius.ci/api/v1/merchant";

/** Parité fixe EUR → XOF (franc CFA). */
export const EUR_TO_XOF = 655.957;

export function eurToXof(eur: number): number {
  return Math.round(eur * EUR_TO_XOF);
}

/** Aperçu FCFA formaté à partir d'un montant en euros. */
export function xofPreview(eur: number): string {
  return new Intl.NumberFormat("fr-FR").format(eurToXof(eur)) + " FCFA";
}

export function geniusConfigured(): boolean {
  return Boolean(
    process.env.GENIUS_PAY_API_KEY && process.env.GENIUS_PAY_API_SECRET,
  );
}

function headers() {
  return {
    "X-API-Key": process.env.GENIUS_PAY_API_KEY ?? "",
    "X-API-Secret": process.env.GENIUS_PAY_API_SECRET ?? "",
    "Content-Type": "application/json",
  };
}

/** Crée un paiement et renvoie l'URL de checkout + la référence. */
export async function createGeniusPayment(opts: {
  amountEur: number;
  description: string;
  customer: { name: string; email: string; phone?: string };
  metadata: Record<string, string>;
  successUrl: string;
  errorUrl: string;
}): Promise<{ checkoutUrl: string; reference: string } | null> {
  if (!geniusConfigured()) return null;
  try {
    const res = await fetch(`${API}/payments`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        amount: eurToXof(opts.amountEur),
        currency: "XOF",
        description: opts.description,
        customer: opts.customer,
        success_url: opts.successUrl,
        error_url: opts.errorUrl,
        metadata: opts.metadata,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => null);
    const d = data?.data;
    if (!res.ok || !d) return null;
    const checkoutUrl = d.checkout_url || d.payment_url;
    const reference = d.reference;
    if (!checkoutUrl || !reference) return null;
    return { checkoutUrl, reference };
  } catch {
    return null;
  }
}

/** Statut serveur-à-serveur d'un paiement (authentifié) : pending|completed|… */
export async function getGeniusPaymentStatus(
  reference: string,
): Promise<string | null> {
  if (!geniusConfigured() || !reference) return null;
  try {
    const res = await fetch(`${API}/payments/${encodeURIComponent(reference)}`, {
      headers: headers(),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.data) return null;
    return String(data.data.status || "");
  } catch {
    return null;
  }
}

/** Statut considéré comme payé. */
export function isPaid(status: string | null): boolean {
  return status === "completed" || status === "success" || status === "paid";
}
