import { NextRequest } from "next/server";
import { handleMerchantWebhook } from "@/lib/payments/merchant";
import { ok, serverError, unauthorized } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * Webhook GeniusPay du compte marchand d'une entreprise (paiements encaissés
 * par ses agents pendant les appels). Signature HMAC obligatoire.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const raw = await req.text();
    if (raw.length > 100_000) return unauthorized();
    const r = await handleMerchantWebhook({
      token: params.token,
      rawBody: raw,
      signature: req.headers.get("x-webhook-signature"),
      timestamp: req.headers.get("x-webhook-timestamp"),
    });
    return r === "ok" ? ok({ received: true }) : unauthorized();
  } catch {
    return serverError();
  }
}
