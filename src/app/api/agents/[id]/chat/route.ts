import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { retrieveContext } from "@/lib/db/knowledge";
import { listCustomToolsFull } from "@/lib/db/custom-tools";
import { getTool, resolveTools } from "@/lib/tools/registry";
import { signPayload } from "@/lib/webhooks/dispatch";
import {
  generateReply,
  type ChatMessage,
  type ResolvedTool,
  type ToolExecutor,
} from "@/lib/llm/chat";
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

    let systemContent = agent.config.systemPrompt;
    // RAG : injecte le contexte pertinent de la base de connaissances.
    if (agent.knowledgeBaseId) {
      const lastUser =
        [...parsed.data.messages].reverse().find((m) => m.role === "user")
          ?.content ?? "";
      const ctx = await retrieveContext(agent.knowledgeBaseId, lastUser);
      if (ctx) {
        systemContent += `\n\n## Base de connaissances\nUtilise ces informations pour répondre avec précision si c'est pertinent :\n${ctx}`;
      }
    }

    const convo = [...parsed.data.messages];
    // Garantit le contexte du message d'accueil même si le client ne l'a pas inclus.
    if (
      agent.config.firstSpeaker === "agent" &&
      agent.config.firstMessage &&
      convo[0]?.role !== "assistant"
    ) {
      convo.unshift({ role: "assistant", content: agent.config.firstMessage });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...convo,
    ];

    // Résout les outils activés (built-in + fonctions personnalisées).
    const enabled = agent.config.tools ?? [];
    const customs = await listCustomToolsFull(session.org.id);
    const customByName = new Map(customs.map((c) => [c.name, c]));
    const tools: ResolvedTool[] = [
      ...resolveTools(enabled).map((d) => ({
        name: d.name,
        description: d.description,
        parameters: d.parameters,
      })),
      ...customs
        .filter((c) => enabled.includes(c.name))
        .map((c) => ({
          name: c.name,
          description: c.description,
          parameters: c.parameters,
        })),
    ];

    const executeTool: ToolExecutor = async (name, args) => {
      const builtin = getTool(name);
      if (builtin) {
        const r = await builtin.handler(args, {
          agentId: agent.id,
          organizationId: session.org.id,
          callId: "test",
          callerNumber: "navigateur",
        });
        return { message: r.message ?? "Outil exécuté.", data: r.data };
      }
      const custom = customByName.get(name);
      if (custom?.serverUrl) {
        try {
          const payload = JSON.stringify({
            tool: name,
            arguments: args,
            timestamp: new Date().toISOString(),
          });
          const res = await fetch(custom.serverUrl, {
            method: custom.method || "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Callpme-Event": "function.call",
              "X-Callpme-Signature": signPayload(custom.secret ?? "", payload),
            },
            body: payload,
            signal: AbortSignal.timeout(5000),
          });
          return {
            message: `Fonction « ${custom.label} » appelée — données envoyées (HTTP ${res.status}).`,
            data: { status: res.status, delivered: res.ok },
          };
        } catch {
          return {
            message: `Fonction « ${custom.label} » appelée (endpoint non joignable en test).`,
            data: { delivered: false },
          };
        }
      }
      return { message: `Fonction « ${name} » exécutée.`, data: {} };
    };

    const result = await generateReply({
      model: agent.config.model,
      role: agent.role,
      messages,
      tools,
      executeTool,
    });
    return ok({ reply: result.text, toolCalls: result.toolCalls });
  } catch {
    return serverError("Impossible de générer la réponse");
  }
}
