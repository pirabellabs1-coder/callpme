/**
 * Client GeniusPay V3 (geniuspay.ci) — mode Checkout.
 * Tous les prix sont affichés et facturés en euros sur Callpme. GeniusPay
 * encaisse en XOF (mobile money) : le montant est converti à la parité fixe
 * du franc CFA au moment du paiement. Secret jamais exposé au client.
 * Clés « sandbox » (pk_sandbox_… / sk_sandbox_…) pour tester sans frais.
 */
import { createHmac, timingSafeEqual } from "crypto";

const API = process.env.GENIUS_PAY_API_URL || "https://geniuspay.ci/api/v1/merchant";

/** Parité fixe EUR → XOF (franc CFA). */
export const EUR_TO_XOF = 655.957;

export function eurToXof(eur: number): number {
  return Math.round(eur * EUR_TO_XOF);
}

/** Montant minimum accepté par GeniusPay (200 XOF). */
export const MIN_XOF = 200;

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
    if (!res.ok || !d) {
      // Diagnostic sans secret : statut HTTP et message de GeniusPay.
      console.error("[geniuspay] création refusée :", res.status, String(data?.message ?? data?.error?.message ?? data?.code ?? "").slice(0, 200));
      return null;
    }
    const checkoutUrl = d.checkout_url || d.payment_url;
    const reference = d.reference;
    if (!checkoutUrl || !reference) return null;
    return { checkoutUrl, reference };
  } catch (e) {
    console.error("[geniuspay] création impossible :", e instanceof Error ? e.message : e);
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

/** Statut définitivement en échec (le paiement ne aboutira plus). */
export function isFailed(status: string | null): boolean {
  return status === "failed" || status === "cancelled" || status === "expired";
}

/** Clés de test GeniusPay (transactions simulées). */
export function geniusSandbox(): boolean {
  return (process.env.GENIUS_PAY_API_KEY ?? "").startsWith("pk_sandbox_");
}

/**
 * Vérifie la signature d'un webhook GeniusPay :
 * HMAC-SHA256(timestamp + "." + corps brut, secret), horodatage de moins de 5 min.
 */
export function verifyGeniusWebhook(rawBody: string, signature: string | null, timestamp: string | null, secret: string, now = Date.now()): boolean {
  if (!signature || !timestamp || !/^\d{9,13}$/.test(timestamp)) return false;
  const ts = Number(timestamp) * (timestamp.length > 10 ? 1 : 1000);
  if (Math.abs(now - ts) > 5 * 60_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const given = signature.replace(/^sha256=/, "").trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Statut considéré comme payé. */
export function isPaid(status: string | null): boolean {
  return status === "completed" || status === "success" || status === "paid";
}
