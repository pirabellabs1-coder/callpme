import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { requireOwnedAgent } from "@/lib/api/agent-access";
import { canUseMinutes } from "@/lib/billing/limits";
import { createVoiceToken } from "@/lib/voice-engine/token";
import { voiceEngineMissing } from "@/lib/telephony/provider";
import { ok, forbidden, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/:id/voice-session — ouvre une conversation vocale de test
 * (micro du navigateur) avec le moteur vocal Callpme. Renvoie l'URL WebSocket
 * du serveur vocal, avec un jeton signé valable 2 minutes pour s'y connecter.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireOwnedAgent(params.id);
    if (!access.ok) return access.response;
    const { session, agent } = access;

    const missing = voiceEngineMissing();
    if (missing.length > 0) {
      return forbidden(`Moteur vocal non configuré : ${missing.join(", ")}.`);
    }
    // La transcription et la voix sont facturées : le test compte dans le quota.
    const quota = await canUseMinutes(session.org.id, session.org.plan);
    if (!quota.ok) return forbidden(quota.message);

    const token = createVoiceToken(
      {
        callId: `web_${Date.now().toString(36)}${randomBytes(6).toString("hex")}`,
        agentId: agent.id,
        organizationId: session.org.id,
        direction: "web",
        from: "navigateur",
        to: agent.phoneNumber ?? "test",
      },
      2 * 60_000,
    );
    const base = (process.env.VOICE_SERVER_URL || "").replace(/\/$/, "");
    return ok({ url: `${base}/ws/web?t=${encodeURIComponent(token)}` });
  } catch {
    return serverError("Impossible d'ouvrir la session vocale");
  }
}
