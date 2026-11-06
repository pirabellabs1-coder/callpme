import { NextRequest } from "next/server";
import { createVoiceToken, verifyVoiceToken } from "@/lib/voice-engine/token";
import { getAgentById } from "@/lib/db/agents";
import { classifyAnsweredBy, sayAndHangup, streamInstructions } from "@/lib/telephony/provider";

export const dynamic = "force-dynamic";

function xml(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

const HANGUP = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;

/**
 * GET/POST /api/telephony/answer?t=… — décroché d'un appel SORTANT (Twilio et
 * Telnyx). Le jeton signé prouve que l'appel vient de Callpme. Avec la
 * détection de répondeur, l'opérateur indique qui a décroché :
 *  - un humain        → l'agent prend la conversation ;
 *  - un répondeur     → après le bip, l'agent laisse un message (ou raccroche) ;
 *  - un fax           → on raccroche.
 */
async function handle(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const payload = verifyVoiceToken(token);
  if (!payload || !token || payload.direction !== "outbound") return xml(sayAndHangup("Appel non autorisé."), 403);

  let params: Record<string, string> = Object.fromEntries(req.nextUrl.searchParams);
  if (req.method === "POST") {
    const raw = await req.text().catch(() => "");
    params = { ...params, ...Object.fromEntries(new URLSearchParams(raw)) };
  }
  const answeredBy = classifyAnsweredBy(params.AnsweredBy ?? params.answered_by);
  if (answeredBy === "fax") return xml(HANGUP);
  if (answeredBy === "machine") {
    const agent = await getAgentById(payload.agentId);
    const action = agent?.config.voicemail?.action ?? "message";
    if (!agent || agent.organizationId !== payload.organizationId || action !== "message") return xml(HANGUP);
    // Nouveau jeton (usage unique) : la session vocale laisse le message puis raccroche.
    const { exp: _exp, jti: _jti, ...rest } = payload;
    const vm = createVoiceToken({ ...rest, metadata: { ...(payload.metadata ?? {}), voicemail: "1" } }, 5 * 60_000);
    return xml(streamInstructions(vm));
  }
  return xml(streamInstructions(token));
}

export const GET = handle;
export const POST = handle;
