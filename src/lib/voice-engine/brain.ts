/**
 * « Cerveau » d'un agent : un tour de conversation complet.
 *
 * Partagé par le chat de test (route /api/agents/:id/chat) et par le moteur
 * vocal Callpme, pour que l'agent se comporte exactement pareil à l'écrit et
 * au téléphone : même prompt, même base de connaissances (RAG), mêmes outils.
 */
import { retrieveContext } from "../db/knowledge";
import { listCustomToolsFull } from "../db/custom-tools";
import { resolveTools } from "../tools/registry";
import { runBuiltinTool } from "../tools/handlers";
import { bookingConfig } from "../agenda/slots";
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
  /** Conversation de test : les outils n'ont pas d'effet externe. */
  test?: boolean;
}

/** Date et heure courantes dans le fuseau de l'agent (indispensable pour l'agenda). */
function nowContext(agent: Agent): string {
  const tz = bookingConfig(agent.config.booking).timezone;
  const now = new Date();
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return `## Contexte
Nous sommes le ${label} (fuseau ${tz}, date du jour ${ymd}). Convertis « demain », « lundi prochain »… en date AAAA-MM-JJ avant d'utiliser les outils d'agenda.`;
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
  systemContent += `\n\n${nowContext(agent)}`;

  // RAG : contexte pertinent pour la dernière question de l'appelant.
  if (agent.knowledgeBaseId) {
    // Les deux dernières prises de parole : une relance (« et le samedi ? »)
    // garde le sujet de la question précédente.
    const query = history
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content)
      .join(" ");
    const kb = await retrieveContext(agent.knowledgeBaseId, query);
    if (kb) {
      systemContent +=
        `\n\n## Base de connaissances\nRéponds à partir de ces informations quand elles sont pertinentes. ` +
        `Si la réponse n'y figure pas, ne l'invente pas : dis-le simplement et propose de prendre un message.\n${kb}`;
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
    const builtin = await runBuiltinTool(name, args, {
      agentId: agent.id,
      organizationId: ctx.organizationId,
      callId: ctx.callId,
      callerNumber: ctx.callerNumber,
      test: ctx.test,
    });
    if (builtin) {
      return {
        message: builtin.message ?? (builtin.ok ? "Outil exécuté." : "Échec de l'outil."),
        // Le message (raison d'un échec, consigne) doit parvenir au LLM.
        data: { ok: builtin.ok, message: builtin.message, ...builtin.data },
      };
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
