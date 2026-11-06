import { NextRequest } from "next/server";
import { recordContactOutcome } from "@/lib/campaigns/engine";
import { readSignedWebhook } from "@/lib/telephony/provider";

export const dynamic = "force-dynamic";

/** Statuts finaux de l'opérateur pour lesquels aucun flux vocal ne s'est ouvert. */
const NOT_CONNECTED: Record<string, "no_answer" | "failed"> = {
  "no-answer": "no_answer",
  busy: "no_answer",
  canceled: "no_answer",
  failed: "failed",
};

/**
 * POST /api/telephony/status — rappel de fin d'appel de l'opérateur (Twilio
 * StatusCallback / TeXML Telnyx). Quand un appel sortant n'a pas abouti
 * (pas de réponse, occupé, échec), le moteur vocal n'a jamais été joint :
 * c'est ce rappel qui sort le contact de campagne de l'état « calling ».
 * Les appels aboutis sont enregistrés par le serveur vocal lui-même.
 */
export async function POST(req: NextRequest) {
  const params = await readSignedWebhook(req, "/api/telephony/status");
  if (!params) return new Response("Requête refusée.", { status: 403 });

  const callId = params.CallSid ?? params.call_sid;
  const outcome = NOT_CONNECTED[(params.CallStatus ?? params.call_status ?? "").toLowerCase()];
  if (callId && outcome) {
    await recordContactOutcome(
      { providerCallId: callId },
      outcome,
      outcome === "no_answer" ? "Pas de réponse" : "Appel en échec",
    );
  }
  return new Response(null, { status: 204 });
}
