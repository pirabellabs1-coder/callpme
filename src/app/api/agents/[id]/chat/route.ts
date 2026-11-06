import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { anyLLMKey } from "@/lib/llm/chat";
import { agentReply } from "@/lib/voice-engine/brain";
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(80),
});

/**
 * POST /api/agents/:id/chat — un tour de conversation avec l'agent.
 * Utilisé par le test d'appel navigateur. L'agent applique réellement son
 * modèle, son prompt, sa base de connaissances (RAG) ET ses outils
 * (function calling) : les fonctions configurées sont exécutées en direct.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const agent = await getAgentById(params.id);
    if (!agent || agent.organizationId !== session.org.id) {
      return notFound("Agent introuvable");
    }
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");

    // Même cerveau que le moteur vocal : prompt, RAG et outils partagés.
    const result = await agentReply(
      { agent, organizationId: session.org.id, callId: "test", callerNumber: "navigateur", test: true },
      parsed.data.messages,
    );
    const messages = result.prepared.messages;

    // Sans clé LLM serveur, on délègue l'inférence au cerveau Claude côté
    // client (Puter) : on renvoie les messages déjà assemblés (prompt système +
    // RAG + historique) et le modèle. `reply` reste un repli local si Puter
    // échoue. Avec une clé serveur, `reply` est déjà la vraie réponse du modèle.
    const useServerLLM = anyLLMKey();
    return ok({
      reply: result.text,
      toolCalls: result.toolCalls,
      ...(useServerLLM
        ? {}
        : {
            usePuter: true,
            model: process.env.PUTER_MODEL || "claude-sonnet-4-5",
            messages,
          }),
    });
  } catch {
    return serverError("Impossible de générer la réponse");
  }
}
