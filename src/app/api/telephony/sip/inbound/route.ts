import { NextRequest } from "next/server";
import { createSipSession, gatewayAuthorized } from "@/lib/telephony/sip";
import { routeInbound } from "@/lib/telephony/routing";
import { telephonyConfigured } from "@/lib/telephony/provider";
import { toE164 } from "@/lib/telephony/e164";

export const dynamic = "force-dynamic";

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * GET /api/telephony/sip/inbound?to=…&from=…&channel=… — appelé par le
 * plan de numérotation Asterisk à l'arrivée d'un appel (fonction CURL).
 * Réponse en texte brut : l'identifiant de session à passer à AudioSocket,
 * ou « REJECT » (numéro non attribué, quota atteint, service indisponible).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (!gatewayAuthorized(req.headers, p)) return text("REJECT", 403);
  if (!telephonyConfigured()) return text("REJECT", 503);

  const to = toE164(p.get("to") ?? "");
  const from = toE164(p.get("from") ?? "") ?? "inconnu";
  const channel = (p.get("channel") ?? "").slice(0, 120);
  if (!to || !/^[\w.-]+$/.test(channel)) return text("REJECT", 400);

  const route = await routeInbound(to);
  if (!route.ok) return text("REJECT");
  const id = await createSipSession({
    organizationId: route.agent.organizationId,
    agentId: route.agent.id,
    direction: "inbound",
    from,
    to,
    channelId: channel,
  });
  return text(id);
}
