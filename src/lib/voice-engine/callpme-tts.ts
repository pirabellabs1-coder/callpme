/**
 * Fournisseur TTS « callpme » : notre propre serveur d'inférence (voix maison).
 *
 * Inactif tant que CALLPME_TTS_URL n'est pas défini : ElevenLabs reste le
 * fournisseur par défaut et les voix maison ne sont ni proposées ni utilisées.
 *
 * Contrat HTTP (détaillé dans docs/voix-maison.md, annexe B) :
 *   POST {CALLPME_TTS_URL}/v1/tts/stream
 *   Authorization: Bearer {CALLPME_TTS_API_KEY}   (si défini)
 *   { "text", "voice": "<modelRef>", "language": "fr", "speed": 1, "format": "ulaw_8000" }
 *   -> 200, corps en flux (chunked) : octets µ-law 8 kHz mono bruts.
 */

export type CallpmeAudioFormat = "ulaw_8000";

/** L'agent a choisi une voix maison (fournisseur « callpme »). */
export function usesInhouseVoice(agent: { config: { voice: { provider: string } } }): boolean {
  return agent.config.voice.provider === "callpme";
}

/** URL du serveur d'inférence (sans barre finale), ou null si absente ou invalide. */
export function callpmeTtsUrl(): string | null {
  const raw = process.env.CALLPME_TTS_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // En production, le flux vocal ne transite pas en clair sur Internet.
    if (u.protocol === "http:" && process.env.NODE_ENV === "production" && !isPrivateHost(u.hostname)) return null;
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Réseau privé (Fly.io .internal, localhost, RFC 1918) : http accepté. */
function isPrivateHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("[fd")
  );
}

export const callpmeTtsConfigured = () => callpmeTtsUrl() !== null;

export interface CallpmeSpeechInput {
  text: string;
  modelRef: string;
  language: string;
  speed?: number;
}

/** Corps et en-têtes de la requête (séparé pour être testable sans réseau). */
export function callpmeSpeechRequest(input: CallpmeSpeechInput, format: CallpmeAudioFormat = "ulaw_8000") {
  const base = callpmeTtsUrl();
  if (!base) throw new Error("Serveur de voix maison non configuré (CALLPME_TTS_URL).");
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/octet-stream" };
  const key = process.env.CALLPME_TTS_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;
  return {
    url: `${base}/v1/tts/stream`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: input.text,
        voice: input.modelRef,
        language: input.language.slice(0, 2),
        speed: Math.min(1.5, Math.max(0.7, input.speed ?? 1)),
        format,
      }),
    } satisfies RequestInit,
  };
}

/** Lance la synthèse ; le corps de la réponse est le flux audio. */
export function callpmeSpeech(input: CallpmeSpeechInput, signal: AbortSignal): Promise<Response> {
  const { url, init } = callpmeSpeechRequest(input);
  return fetch(url, { ...init, signal });
}

/** Synthèse complète (aperçus, échantillon publié), bornée en taille et en temps. */
export async function callpmeSpeechBuffer(input: CallpmeSpeechInput, timeoutMs = 30_000): Promise<Uint8Array> {
  const res = await callpmeSpeech(input, AbortSignal.timeout(timeoutMs));
  if (!res.ok) throw new Error(`Serveur de voix maison : HTTP ${res.status}.`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("Serveur de voix maison : audio vide.");
  if (buf.length > 8000 * 120) throw new Error("Serveur de voix maison : audio trop long.");
  return buf;
}
