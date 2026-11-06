import { NextRequest } from "next/server";
import { corsHeaders, widgetAccess, widgetJson } from "@/lib/widget/access";
import { prisma } from "@/lib/db/client";
import { canUseMinutes } from "@/lib/billing/limits";
import { createVoiceToken } from "@/lib/voice-engine/token";
import { voiceEngineMissing } from "@/lib/telephony/provider";
import { isRateLimited } from "@/lib/security/rate-limit";
import { takeDailyQuota } from "@/lib/security/daily-quota";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function visitorIp(req: NextRequest): string {
  return (req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for") ?? "?")
    .split(",")[0]
    .trim();
}

/**
 * POST /api/widget/session { agent } — un visiteur du site lance une
 * conversation vocale. Renvoie l'URL du serveur vocal avec un jeton à usage
 * unique (2 minutes pour se connecter). Compte dans les minutes de l'offre.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const body = await req.json().catch(() => null);
  const access = await widgetAccess(req, typeof body?.agent === "string" ? body.agent : null);
  if (!access.ok) return access.response;
  const { agent, host } = access;
  const busy = (msg: string, status = 429) => widgetJson({ error: msg }, status, origin);

  // Un visiteur : quelques conversations par quart d'heure. Un agent : un plafond par minute.
  if (isRateLimited(`widget-ip:${visitorIp(req)}`, 5, 15 * 60_000) || isRateLimited(`widget-agent:${agent.id}`, 30, 60_000)) {
    return busy("Trop de demandes. Réessayez dans quelques minutes.");
  }
  if (voiceEngineMissing().length > 0) return busy("Assistant vocal momentanément indisponible.", 503);

  const org = await prisma.organization.findUnique({ where: { id: agent.organizationId }, select: { plan: true } });
  const quota = await canUseMinutes(agent.organizationId, org?.plan ?? "starter");
  if (!quota.ok) return busy("Assistant momentanément indisponible.", 503);
  // Plafond quotidien persistant (toutes instances) contre l'abus d'un site.
  if (!access.preview && !(await takeDailyQuota(agent.organizationId, "widget"))) {
    return busy("Assistant momentanément indisponible.", 503);
  }

  const token = createVoiceToken(
    {
      callId: `widget_${Date.now().toString(36)}`,
      agentId: agent.id,
      organizationId: agent.organizationId,
      direction: "web",
      from: "site web",
      to: host,
      // Conversation réelle (outils actifs) sauf aperçu depuis le tableau de bord.
      metadata: access.preview ? { channel: "preview" } : { channel: "widget", site: host },
    },
    2 * 60_000,
  );
  const base = (process.env.VOICE_SERVER_URL || "").replace(/\/$/, "");
  return widgetJson({ url: `${base}/ws/web?t=${encodeURIComponent(token)}` }, 200, origin);
}
