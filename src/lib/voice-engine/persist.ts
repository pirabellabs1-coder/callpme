/**
 * Fin d'appel : enregistre l'appel Callpme (transcription, durée, statut,
 * résumé), met à jour le contact de campagne et envoie le webhook
 * `call.completed` / `call.transferred`. Remplace l'ancien webhook Vapi.
 */
import { prisma } from "../db/client";
import { dispatchEvent } from "../webhooks/dispatch";
import { anyLLMKey, generateReply } from "../llm/chat";
import type { Agent, CallStatus, TranscriptTurn } from "../shared/types";

export interface FinishCallInput {
  agent: Agent;
  organizationId: string;
  direction: "inbound" | "outbound" | "web";
  from: string;
  to: string;
  startedAt: number;
  transcript: TranscriptTurn[];
  status: CallStatus;
  metadata?: Record<string, string>;
  /** Identifiant de l'appel chez l'opérateur (Twilio CallSid, Telnyx…). */
  providerCallId?: string | null;
  /** Identifiant de session vocale (jeton) utilisé par les outils pendant l'appel. */
  sessionCallId?: string;
  /** Issue connue d'avance (ex. message laissé sur répondeur) : pas de résumé LLM. */
  outcome?: string;
}

/** Résumé court de l'appel : LLM si disponible, sinon repli déterministe. */
async function summarize(agent: Agent, transcript: TranscriptTurn[]): Promise<{ summary: string; outcome: string }> {
  const spoken = transcript.filter((t) => t.speaker !== "tool");
  const tools = transcript.filter((t) => t.speaker === "tool").map((t) => t.toolName);
  const fallbackOutcome = tools.includes("bookAppointment")
    ? "Rendez-vous pris"
    : tools.includes("transferToHuman")
      ? "Transféré à un humain"
      : spoken.some((t) => t.speaker === "caller")
        ? "Appel traité"
        : "Sans réponse";
  if (!anyLLMKey() || spoken.length < 2) {
    const firstAsk = spoken.find((t) => t.speaker === "caller")?.text ?? "";
    return { summary: firstAsk ? `Demande : ${firstAsk.slice(0, 200)}` : "Appel sans échange.", outcome: fallbackOutcome };
  }
  try {
    const dialogue = spoken.map((t) => `${t.speaker === "agent" ? "Agent" : "Appelant"} : ${t.text}`).join("\n");
    const res = await generateReply({
      model: agent.config.model,
      role: agent.role,
      messages: [
        {
          role: "system",
          content:
            "Tu résumes un appel téléphonique en français. Réponds en JSON strict : " +
            '{"summary": "2 phrases factuelles maximum", "outcome": "3 à 5 mots, ex. Rendez-vous pris"}.',
        },
        { role: "user", content: dialogue.slice(0, 12000) },
      ],
      tools: [],
      executeTool: async () => ({ message: "" }),
    });
    const json = JSON.parse(res.text.slice(res.text.indexOf("{"), res.text.lastIndexOf("}") + 1));
    return {
      summary: String(json.summary ?? "").slice(0, 600) || "Appel traité.",
      outcome: String(json.outcome ?? "").slice(0, 80) || fallbackOutcome,
    };
  } catch {
    return { summary: "Appel traité.", outcome: fallbackOutcome };
  }
}

export async function finishCall(input: FinishCallInput) {
  const durationSec = Math.max(0, Math.round((Date.now() - input.startedAt) / 1000));
  const { summary, outcome } = input.outcome
    ? { summary: input.outcome, outcome: input.outcome }
    : await summarize(input.agent, input.transcript);
  // Les tests navigateur sont enregistrés comme appels entrants de test.
  const direction = input.direction === "outbound" ? "outbound" : "inbound";

  const call = await prisma.call.create({
    data: {
      agentId: input.agent.id,
      direction,
      fromNumber: input.from,
      toNumber: input.to,
      status: input.status,
      durationSec,
      transcript: JSON.stringify(input.transcript),
      summary,
      outcome,
      providerCallId: input.providerCallId ?? null,
    },
  });

  // Rendez-vous et fiches créés pendant l'appel : rattachés à l'appel enregistré.
  if (input.sessionCallId) {
    const where = { organizationId: input.organizationId, callRef: input.sessionCallId };
    await Promise.all([
      prisma.appointment.updateMany({ where, data: { callRef: call.id } }),
      prisma.lead.updateMany({ where, data: { callRef: call.id } }),
    ]).catch(() => {});
  }

  // Contact de campagne : statut final + issue.
  const contactId = input.metadata?.contactId;
  if (contactId) {
    await prisma.contact
      .updateMany({
        where: { id: contactId, campaign: { organizationId: input.organizationId } },
        data: {
          status: input.status === "completed" || input.status === "transferred" ? "completed" : input.status === "missed" ? "no_answer" : "failed",
          outcome,
          calledAt: new Date(),
        },
      })
      .catch(() => {});
  }

  await dispatchEvent(input.organizationId, input.status === "transferred" ? "call.transferred" : "call.completed", {
    id: call.id,
    agentId: input.agent.id,
    agentName: input.agent.name,
    direction,
    durationSec,
    status: input.status,
    outcome,
    summary,
  }).catch(() => {});

  return call;
}
