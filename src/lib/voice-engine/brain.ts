/**
 * « Cerveau » d'un agent : un tour de conversation complet.
 *
 * Partagé par le chat de test (route /api/agents/:id/chat) et par le moteur
 * vocal Callpme, pour que l'agent se comporte exactement pareil à l'écrit et
 * au téléphone : même prompt, même base de connaissances (RAG), mêmes outils.
 */
import { retrieveContext } from "../db/knowledge";
import { listCustomToolsFull } from "../db/custom-tools";
import { getTool, resolveTools } from "../tools/registry";
import { signPayload } from "../webhooks/dispatch";
import { publicRequest } from "../net/safe-fetch";
import {
  generateReply,
  type ChatMessage,
  type GenerateResult,
  type ResolvedTool,
  type ToolExecutor,
} from "../llm/chat";
import type { Agent } from "../shared/types";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface BrainContext {
  agent: Agent;
  organizationId: string;
  /** Identifiant de l'appel (transmis aux outils). */
  callId: string;
  /** Numéro de l'appelant, ou « navigateur » en test. */
  callerNumber: string;
  /** Consigne ajoutée au prompt système (ex. style oral pour la voix). */
  extraInstructions?: string;
}

export interface PreparedTurn {
  messages: ChatMessage[];
  tools: ResolvedTool[];
  executeTool: ToolExecutor;
}

/** Assemble prompt système + RAG + historique et résout les outils activés. */
export async function prepareTurn(ctx: BrainContext, history: Turn[]): Promise<PreparedTurn> {
  const { agent } = ctx;
  let systemContent = agent.config.systemPrompt;
  if (ctx.extraInstructions) systemContent += `\n\n${ctx.extraInstructions}`;

  // RAG : contexte pertinent pour la dernière question de l'appelant.
  if (agent.knowledgeBaseId) {
    const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    const kb = await retrieveContext(agent.knowledgeBaseId, lastUser);
    if (kb) {
      systemContent += `\n\n## Base de connaissances\nUtilise ces informations pour répondre avec précision si c'est pertinent :\n${kb}`;
    }
  }

  const convo = [...history];
  // Garantit le contexte du message d'accueil.
  if (agent.config.firstSpeaker === "agent" && agent.config.firstMessage && convo[0]?.role !== "assistant") {
    convo.unshift({ role: "assistant", content: agent.config.firstMessage });
  }
  const messages: ChatMessage[] = [{ role: "system", content: systemContent }, ...convo];

  // Outils activés : intégrés + fonctions personnalisées de l'organisation.
  const enabled = agent.config.tools ?? [];
  const customs = await listCustomToolsFull(ctx.organizationId);
  const customByName = new Map(customs.map((c) => [c.name, c]));
  const tools: ResolvedTool[] = [
    ...resolveTools(enabled).map((d) => ({ name: d.name, description: d.description, parameters: d.parameters })),
    ...customs
      .filter((c) => enabled.includes(c.name))
      .map((c) => ({ name: c.name, description: c.description, parameters: c.parameters })),
  ];

  const executeTool: ToolExecutor = async (name, args) => {
    const builtin = getTool(name);
    if (builtin) {
      const r = await builtin.handler(args, {
        agentId: agent.id,
        organizationId: ctx.organizationId,
        callId: ctx.callId,
        callerNumber: ctx.callerNumber,
      });
      return { message: r.message ?? "Outil exécuté.", data: r.data };
    }
    const custom = customByName.get(name);
    if (custom?.serverUrl) {
      try {
        const payload = JSON.stringify({
          tool: name,
          arguments: args,
          callId: ctx.callId,
          timestamp: new Date().toISOString(),
        });
        // Requête protégée SSRF (IP vérifiée à la connexion, pas de redirection).
        const res = await publicRequest(custom.serverUrl, {
          method: custom.method || "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Callpme-Event": "function.call",
            "X-Callpme-Signature": signPayload(custom.secret ?? "", payload),
          },
          body: payload,
          timeoutMs: 5000,
        });
        return {
          message: `Fonction « ${custom.label} » appelée — données envoyées (HTTP ${res.status}).`,
          data: { status: res.status, delivered: res.status >= 200 && res.status < 300 },
        };
      } catch {
        return { message: `Fonction « ${custom.label} » : point d'accès injoignable.`, data: { delivered: false } };
      }
    }
    return { message: `Fonction « ${name} » exécutée.`, data: {} };
  };

  return { messages, tools, executeTool };
}

/** Un tour complet : prépare le contexte puis génère la réponse (outils compris). */
export async function agentReply(ctx: BrainContext, history: Turn[]): Promise<GenerateResult & { prepared: PreparedTurn }> {
  const prepared = await prepareTurn(ctx, history);
  const result = await generateReply({
    model: ctx.agent.config.model,
    role: ctx.agent.role,
    messages: prepared.messages,
    tools: prepared.tools,
    executeTool: prepared.executeTool,
  });
  return { ...result, prepared };
}
