/**
 * Fin d'appel : enregistre l'appel Callpme (transcription, durée, statut,
 * résumé), met à jour le contact de campagne et envoie le webhook
 * `call.completed` / `call.transferred`. Remplace l'ancien webhook Vapi.
 */
import { prisma } from "../db/client";
import { recordContactOutcome } from "../campaigns/engine";
import { dispatchEvent } from "../webhooks/dispatch";
import { analyzeCall } from "../analysis/analyze";
import { consumeExtraMinutes } from "../billing/limits";
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
  /** Message laissé sur un répondeur (contact de campagne : « messagerie », relançable). */
  voicemail?: boolean;
}

export async function finishCall(input: FinishCallInput) {
  const durationSec = Math.max(0, Math.round((Date.now() - input.startedAt) / 1000));
  // Analyse unique : résumé, issue, score, sentiment et données à relever.
  const analysis = input.outcome ? null : await analyzeCall(input.agent, input.transcript, durationSec);
  const summary = analysis?.summary ?? input.outcome ?? "Appel traité.";
  const outcome = input.outcome ?? analysis?.outcome ?? "Appel traité";
  const extracted = analysis && Object.keys(analysis.data).length ? analysis.data : null;
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
      extracted: extracted ? JSON.stringify(extracted) : null,
      providerCallId: input.providerCallId ?? null,
      // Évaluation enregistrée pour chaque appel où l'appelant s'est exprimé.
      ...(analysis && input.transcript.some((t) => t.speaker === "caller")
        ? {
            evaluation: {
              create: {
                successScore: analysis.successScore,
                goalAchieved: analysis.goalAchieved,
                sentiment: analysis.sentiment,
                summary: analysis.summary,
              },
            },
          }
        : {}),
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
    const voicemail = Boolean(input.voicemail);
    const status =
      input.status === "completed" || input.status === "transferred"
        ? "completed"
        : voicemail
          ? "voicemail"
          : input.status === "missed"
            ? "no_answer"
            : "failed";
    // Relance planifiée selon les réglages de la campagne (non-réponse, répondeur…).
    await recordContactOutcome({ contactId, organizationId: input.organizationId }, status, outcome).catch(() => {});
  }

  // Minutes rechargées : seule la partie au-delà de l'offre est décomptée.
  await consumeExtraMinutes(input.organizationId, durationSec).catch(() => {});

  await dispatchEvent(input.organizationId, input.status === "transferred" ? "call.transferred" : "call.completed", {
    id: call.id,
    agentId: input.agent.id,
    agentName: input.agent.name,
    direction,
    durationSec,
    status: input.status,
    outcome,
    summary,
    data: extracted,
    evaluation: analysis
      ? { successScore: analysis.successScore, goalAchieved: analysis.goalAchieved, sentiment: analysis.sentiment }
      : null,
  }).catch(() => {});

  return call;
}
