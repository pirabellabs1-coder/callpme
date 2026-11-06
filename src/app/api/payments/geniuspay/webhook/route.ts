import { NextRequest } from "next/server";
import { confirmAndActivatePayment } from "@/lib/payments/confirm";
import { verifyGeniusWebhook } from "@/lib/payments/geniuspay";
import { ok, serverError, unauthorized } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * Webhook GeniusPay. Deux protections :
 * - si GENIUS_PAY_WEBHOOK_SECRET est défini, la signature HMAC est exigée ;
 * - dans tous les cas, `confirmAndActivatePayment` re-vérifie le statut auprès
 *   de GeniusPay (appel authentifié) avant d'activer quoi que ce soit.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const secret = process.env.GENIUS_PAY_WEBHOOK_SECRET;
    if (secret && !verifyGeniusWebhook(raw, req.headers.get("x-webhook-signature"), req.headers.get("x-webhook-timestamp"), secret)) {
      return unauthorized();
    }
    let body: { data?: { metadata?: Record<string, unknown> }; metadata?: Record<string, unknown> } | null = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
    const meta = body?.data?.metadata ?? body?.metadata ?? {};
    const paymentId = meta?.paymentId;
    if (typeof paymentId === "string" && paymentId.length <= 40) {
      await confirmAndActivatePayment(paymentId);
    }
    return ok({ received: true });
  } catch {
    return serverError();
  }
}
