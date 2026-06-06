/**
 * Intégration téléphonie RÉELLE via Vapi.
 *
 * Vapi héberge le moteur temps réel (média WebSocket + STT/TTS + tour de
 * parole). Callpme transforme un agent en « assistant » Vapi et déclenche de
 * vrais appels (sortants pour les tests/campagnes ; entrants gérés par le
 * numéro côté Vapi). La clé vit uniquement en variable d'environnement.
 */
import type { Agent } from "@/lib/shared/types";
import { getPresetVoice } from "@/lib/voices/catalog";
import { sanitizeSpoken } from "@/lib/voice/speech-text";

const API = "https://api.vapi.ai";

export function vapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY);
}

export function defaultPhoneNumberId(): string | null {
  return process.env.VAPI_PHONE_NUMBER_ID || null;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Voix Azure française selon le genre de la voix de l'agent. */
function azureVoice(agent: Agent): string {
  const preset = agent.config.voice.voiceId
    ? getPresetVoice(agent.config.voice.voiceId)
    : undefined;
  return preset?.gender === "masculine" ? "fr-FR-HenriNeural" : "fr-FR-DeniseNeural";
}

/**
 * Construit l'assistant Vapi (inline) à partir de la config d'un agent Callpme :
 * même prompt système, même message d'accueil, voix française, STT/TTS français.
 */
export function buildAssistant(agent: Agent, organizationName: string) {
  const firstSpeaker = agent.config.firstSpeaker ?? "agent";
  const firstMessage =
    sanitizeSpoken(agent.config.firstMessage, { agentName: agent.name, organizationName }) ||
    "Bonjour, comment puis-je vous aider ?";
  return {
    name: agent.name.slice(0, 40),
    firstMessage,
    firstMessageMode:
      firstSpeaker === "agent" ? "assistant-speaks-first" : "assistant-waits-for-user",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: agent.config.model?.temperature ?? 0.5,
      messages: [{ role: "system", content: agent.config.systemPrompt }],
    },
    voice: { provider: "azure", voiceId: azureVoice(agent) },
    transcriber: { provider: "deepgram", model: "nova-2", language: "fr" },
    maxDurationSeconds: Math.min(Math.max(agent.config.maxDurationSec || 600, 30), 1800),
    // Compte-rendu de fin d'appel renvoyé à Callpme (transcript + enregistrement).
    server: {
      url: `${process.env.PUBLIC_URL || "https://www.callpme.com"}/api/telephony/vapi/webhook`,
      ...(process.env.VAPI_WEBHOOK_SECRET
        ? { secret: process.env.VAPI_WEBHOOK_SECRET }
        : {}),
    },
  };
}

export interface PlaceCallResult {
  ok: boolean;
  callId?: string;
  status?: string;
  error?: string;
}

/** Normalise un numéro au format E.164 (best-effort, défaut France). */
export function toE164(raw: string): string | null {
  let s = (raw || "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    if (s.startsWith("0") && s.length === 10) s = "+33" + s.slice(1); // FR
    else s = "+" + s;
  }
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

/** Déclenche un VRAI appel sortant : l'agent appelle `toNumber`. */
export async function placeOutboundCall(opts: {
  agent: Agent;
  organizationName: string;
  toNumber: string;
  phoneNumberId?: string;
  /** Métadonnées propagées au webhook (ex. contactId, campaignId). */
  metadata?: Record<string, string>;
}): Promise<PlaceCallResult> {
  if (!vapiConfigured()) return { ok: false, error: "Téléphonie non connectée." };
  const phoneNumberId = opts.phoneNumberId || defaultPhoneNumberId();
  if (!phoneNumberId) return { ok: false, error: "Aucun numéro Vapi configuré." };
  const number = toE164(opts.toNumber);
  if (!number) return { ok: false, error: "Numéro invalide (format attendu : +33…)." };

  try {
    const res = await fetch(`${API}/call`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        phoneNumberId,
        customer: { number },
        assistant: buildAssistant(opts.agent, opts.organizationName),
        metadata: {
          agentId: opts.agent.id,
          source: "callpme",
          ...(opts.metadata ?? {}),
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (typeof data?.message === "string" && data.message) ||
        (Array.isArray(data?.message) && data.message.join(", ")) ||
        `Vapi a refusé l'appel (HTTP ${res.status}).`;
      return { ok: false, error: msg };
    }
    return { ok: true, callId: data.id, status: data.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Appel impossible." };
  }
}

/** Récupère le détail d'un appel Vapi (transcript, enregistrement, statut). */
export async function getVapiCall(id: string): Promise<Record<string, unknown> | null> {
  if (!vapiConfigured()) return null;
  try {
    const res = await fetch(`${API}/call/${id}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
