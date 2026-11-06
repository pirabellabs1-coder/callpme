import { NextRequest } from "next/server";
import { verifyVoiceToken } from "@/lib/voice-engine/token";
import { sayAndHangup, streamInstructions } from "@/lib/telephony/provider";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/telephony/texml?t=… — instructions TeXML d'un appel SORTANT
 * Telnyx. Telnyx appelle cette URL au décroché ; le jeton signé (créé par
 * placeOutboundCall) prouve que l'appel vient bien de Callpme.
 */
function handle(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const payload = verifyVoiceToken(token);
  const body = payload && token ? streamInstructions(token) : sayAndHangup("Appel non autorisé.");
  return new Response(body, {
    status: payload ? 200 : 403,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export const GET = handle;
export const POST = handle;
