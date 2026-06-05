import { NextRequest } from "next/server";
import { confirmAndActivatePayment } from "@/lib/payments/confirm";
import { ok, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * Webhook GeniusPay. On ne fait pas confiance à la charge utile seule :
 * `confirmAndActivatePayment` re-vérifie le statut auprès de GeniusPay
 * (appel authentifié) avant d'activer quoi que ce soit.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const meta = body?.data?.metadata ?? body?.metadata ?? {};
    const paymentId = meta?.paymentId;
    if (paymentId) {
      await confirmAndActivatePayment(String(paymentId));
    }
    return ok({ received: true });
  } catch {
    return serverError();
  }
}
