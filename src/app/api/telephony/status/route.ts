import { NextRequest } from "next/server";
import { recordContactOutcome } from "@/lib/campaigns/engine";
import { readSignedWebhook } from "@/lib/telephony/provider";
import { settleHold } from "@/lib/billing/credit";
import { recordCallbackOutcome, requestCallback } from "@/lib/callbacks/engine";
import { agentForNumber } from "@/lib/telephony/routing";
import { toE164 } from "@/lib/telephony/e164";

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
  // Règlement du crédit sur la durée FACTURÉE par l'opérateur (détection de répondeur
  // et appels décrochés sans session compris). 0 s = appel non abouti : tout est rendu.
  if (callId) {
    const billed = Number(params.CallDuration ?? params.call_duration ?? 0);
    await settleHold({ providerCallId: callId }, Number.isFinite(billed) ? billed : 0).catch((e) =>
      console.error("[crédit] règlement opérateur impossible :", callId, e instanceof Error ? e.message : e),
    );
  }
  const callStatus = (params.CallStatus ?? params.call_status ?? "").toLowerCase();
  const outcome = NOT_CONNECTED[callStatus];
  const inbound = (params.Direction ?? params.direction ?? "").toLowerCase().startsWith("inbound");
  const duration = Number(params.CallDuration ?? params.call_duration ?? 0) || 0;
  if (callId && outcome && !inbound) {
    const label = outcome === "no_answer" ? "Pas de réponse" : "Appel en échec";
    await recordContactOutcome({ providerCallId: callId }, outcome, label);
    await recordCallbackOutcome({ providerCallId: callId }, outcome, { outcome: label }).catch(() => {});
  }
  // Rappel décroché mais clos sans session (répondeur raccroché, fax) ou avant la fin de session :
  // il ne reste pas « en cours ». La session, si elle existe, rattache ensuite son appel enregistré.
  if (callId && !inbound && callStatus === "completed") {
    await recordCallbackOutcome({ providerCallId: callId }, "completed", { outcome: "Appel décroché" }).catch(() => {});
  }
  // Appel ENTRANT raccroché avant que la ligne soit reliée à l'agent (bip très court) :
  // aucune session ne s'est ouverte, c'est ce rappel qui déclenche le rappel automatique.
  if (inbound && (outcome || callStatus === "completed") && duration === 0) {
    const to = toE164(params.To ?? params.to ?? "");
    const agent = to ? await agentForNumber(to).catch(() => null) : null;
    // Mode « bip » : « occupé » = l'appel que nous avons nous-mêmes refusé, déjà mis en file.
    const ownReject = agent?.config.callback?.mode === "flash" && callStatus === "busy";
    if (agent?.config.callback?.enabled && !ownReject) {
      await requestCallback({ agent, from: params.From ?? params.from ?? "", reason: "missed" }).catch(() => {});
    }
  }
  return new Response(null, { status: 204 });
}
