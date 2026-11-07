/**
 * Transcription en temps réel (STT).
 *
 * Entrée : audio µ-law 8 kHz (format téléphonique). Sortie : événements
 * « parole détectée », transcriptions intermédiaires et finales, fin de tour.
 *
 * Le fournisseur dépend de la langue de l'agent (voir ./languages) :
 * - français : Deepgram en streaming WebSocket (DEEPGRAM_MODEL, défaut nova-3, mots-clés de l'appel) ;
 * - yoruba, haoussa, wolof : Google Chirp 3, ElevenLabs Scribe v2 ou Spitch,
 *   phrase par phrase (./stt-batch) : aucun ne documente de streaming pour ces langues.
 * Chaque fournisseur reste éteint tant que sa clé n'est pas posée.
 */
import WebSocket from "ws";
import { googleAccessToken, googleServiceAccount } from "./google-auth";
import { sttCandidates, sttLanguageCode, voiceLanguage, type SttProviderId } from "./languages";
import { openUtteranceStt, type BatchTranscriber } from "./stt-batch";

export interface SttEvents {
  /** L'appelant commence à parler (sert à interrompre l'agent). */
  onSpeechStarted?: () => void;
  /** Texte reconnu ; `isFinal` = segment stabilisé. */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Fin de tour de parole : l'appelant a fini sa phrase. */
  onUtteranceEnd?: () => void;
  onError?: (err: Error) => void;
}

export interface SttStream {
  send(mulaw: Buffer): void;
  close(): void;
}

export function sttConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

/** Clé présente pour ce fournisseur ? */
export function sttProviderConfigured(p: SttProviderId): boolean {
  if (p === "deepgram") return Boolean(process.env.DEEPGRAM_API_KEY);
  if (p === "google") return googleServiceAccount() !== null;
  if (p === "elevenlabs") return Boolean(process.env.ELEVENLABS_API_KEY);
  return Boolean(process.env.SPITCH_API_KEY);
}

/**
 * Fournisseur de transcription pour une langue : VOICE_STT_<CODE> s'il est
 * configuré (ex. VOICE_STT_YO=spitch), sinon le premier candidat dont la clé existe.
 * Mode bilingue : ElevenLabs Scribe, qui détecte la langue de chaque phrase.
 */
export function sttProviderFor(language: string, bilingual = false): SttProviderId | null {
  const lang = voiceLanguage(language);
  if (!lang?.local) return sttProviderConfigured("deepgram") ? "deepgram" : null;
  if (bilingual) return sttProviderConfigured("elevenlabs") ? "elevenlabs" : null;
  const candidates = sttCandidates(language);
  const wanted = process.env[`VOICE_STT_${language.slice(0, 2).toUpperCase()}`] as SttProviderId | undefined;
  if (wanted && candidates.includes(wanted) && sttProviderConfigured(wanted)) return wanted;
  return candidates.find(sttProviderConfigured) ?? null;
}

/** Ouvre la transcription adaptée à la langue de l'agent. */
export function openStt(
  language: string,
  events: SttEvents,
  opts: { bilingual?: boolean; keyterms?: string[] } = {},
): SttStream {
  const lang = language || "fr-FR";
  const provider = sttProviderFor(lang, Boolean(opts.bilingual));
  if (!provider) throw new Error(`Aucune transcription configurée pour la langue ${lang}.`);
  if (provider === "deepgram") return openDeepgram(lang, events, opts.keyterms);
  return openUtteranceStt(batchTranscriber(provider, lang, Boolean(opts.bilingual)), events);
}

/** Transcription d'une phrase (WAV 8 kHz) chez un fournisseur « par fichier ». */
export function batchTranscriber(provider: Exclude<SttProviderId, "deepgram">, language: string, bilingual = false): BatchTranscriber {
  if (provider === "google") return (wav, signal) => googleRecognize(wav, sttLanguageCode(language, "google"), signal);
  if (provider === "spitch") return (wav, signal) => spitchTranscribe(wav, sttLanguageCode(language, "spitch"), signal);
  // Bilingue : pas de langue imposée, Scribe la détecte (français ou langue locale).
  return (wav, signal) => scribeTranscribe(wav, bilingual ? null : sttLanguageCode(language, "elevenlabs"), signal);
}

/**
 * Google Speech-to-Text v2, modèle chirp_3 (docs.cloud.google.com/speech-to-text/v2/docs/chirp_3-model).
 * Région : GOOGLE_STT_LOCATION (défaut us). Projet : GOOGLE_STT_PROJECT, sinon celui du compte de service.
 */
async function googleRecognize(wav: Buffer, languageCode: string, signal: AbortSignal): Promise<string> {
  const sa = googleServiceAccount();
  const project = process.env.GOOGLE_STT_PROJECT || sa?.project_id;
  if (!project) throw new Error("GOOGLE_STT_PROJECT manquant.");
  const location = process.env.GOOGLE_STT_LOCATION || "us";
  const token = await googleAccessToken(signal);
  // Région « global » : hôte sans préfixe.
  const host = location === "global" ? "speech.googleapis.com" : `${location}-speech.googleapis.com`;
  const url = `https://${host}/v2/projects/${encodeURIComponent(project)}/locations/${location}/recognizers/_:recognize`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      config: { model: process.env.GOOGLE_STT_MODEL || "chirp_3", languageCodes: [languageCode], autoDecodingConfig: {} },
      content: wav.toString("base64"),
    }),
  });
  if (!res.ok) throw new Error(`Transcription refusée (google, HTTP ${res.status}).`);
  const body = (await res.json()) as { results?: { alternatives?: { transcript?: string }[] }[] };
  return (body.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

/** ElevenLabs Scribe v2, par fichier (elevenlabs.io/docs/api-reference/speech-to-text/convert). */
async function scribeTranscribe(wav: Buffer, languageCode: string | null, signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.set("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.set("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "phrase.wav");
  if (languageCode) form.set("language_code", languageCode);
  form.set("tag_audio_events", "false");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    signal,
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription refusée (elevenlabs, HTTP ${res.status}).`);
  const body = (await res.json()) as { text?: string };
  return body.text?.trim() ?? "";
}

/** Spitch, par fichier (POST /v1/transcriptions, d'après le SDK officiel spi-tch/spitch-typescript). */
async function spitchTranscribe(wav: Buffer, languageCode: string, signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.set("language", languageCode);
  form.set("content", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "phrase.wav");
  const res = await fetch("https://api.spitch.app/v1/transcriptions", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${process.env.SPITCH_API_KEY ?? ""}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription refusée (spitch, HTTP ${res.status}).`);
  const body = (await res.json()) as { text?: string };
  return body.text?.trim() ?? "";
}

/** Mots propres à l'appel (entreprise, noms…) que la transcription doit privilégier. */
export function cleanKeyterms(terms: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of terms) {
    const v = (t ?? "").replace(/[^A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u0250-\u02AF\u0300-\u036F\u1E00-\u1EFF0-9' -]/g, " ").replace(/\s+/g, " ").trim();
    if (v.length >= 2 && v.length <= 40) out.add(v);
  }
  return Array.from(out).slice(0, 20);
}

export function openDeepgram(language: string, events: SttEvents, keyterms: string[] = []): SttStream {
  // Repli automatique : si Deepgram refuse la connexion (modèle ou mots-clés non acceptés),
  // on rouvre une fois sans mots-clés, en nova-2. L'appel n'est jamais privé de transcription.
  let current = openDeepgramOnce(language, events, keyterms, undefined, () => {
    console.error("[stt] connexion Deepgram refusée : nouvel essai en nova-2 sans mots-clés.");
    current = openDeepgramOnce(language, events, [], "nova-2");
  });
  return {
    send: (mulaw) => current.send(mulaw),
    close: () => current.close(),
  };
}

function openDeepgramOnce(
  language: string,
  events: SttEvents,
  keyterms: string[],
  forcedModel?: string,
  onRefused?: () => void,
): SttStream {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY manquant : la transcription est indisponible.");
  // nova-3 : meilleure reconnaissance au téléphone (noms, accents) et mots-clés (« keyterm »).
  const model = forcedModel || process.env.DEEPGRAM_MODEL || "nova-3";
  const params = new URLSearchParams({
    model,
    language: (language || "fr").slice(0, 2),
    encoding: "mulaw",
    sample_rate: "8000",
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    punctuate: "true",
    vad_events: "true",
    endpointing: "300",
    utterance_end_ms: "1000",
  });
  if (model.startsWith("nova-3")) for (const t of cleanKeyterms(keyterms)) params.append("keyterm", t);
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
    headers: { Authorization: `Token ${key}` },
  });
  const pending: Buffer[] = [];
  let keepAlive: NodeJS.Timeout | null = null;
  let closed = false;

  ws.on("open", () => {
    // Fermé avant même d'être ouvert : on ne garde rien en vie.
    if (closed) return ws.terminate();
    for (const b of pending.splice(0)) ws.send(b);
    // Deepgram ferme la connexion après ~10 s sans audio : on la maintient.
    keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
    }, 8000);
  });

  ws.on("message", (raw) => {
    let msg: {
      type?: string;
      is_final?: boolean;
      speech_final?: boolean;
      channel?: { alternatives?: { transcript?: string }[] };
    };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === "SpeechStarted") return events.onSpeechStarted?.();
    if (msg.type === "UtteranceEnd") return events.onUtteranceEnd?.();
    if (msg.type === "Results") {
      const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
      if (text) events.onTranscript?.(text, Boolean(msg.is_final));
      if (msg.speech_final) events.onUtteranceEnd?.();
    }
  });

  let opened = false;
  ws.on("open", () => {
    opened = true;
  });
  // Refus à l'ouverture (HTTP 400…) : repli plutôt qu'un agent sourd.
  ws.on("unexpected-response", (_req, res) => {
    console.error(`[stt] Deepgram a refusé la connexion (HTTP ${res.statusCode}, modèle ${model}).`);
    if (onRefused && !closed) {
      closed = true;
      ws.terminate();
      onRefused();
    }
  });
  ws.on("error", (e) => {
    if (!opened && onRefused && !closed) {
      closed = true;
      onRefused();
      return;
    }
    events.onError?.(e instanceof Error ? e : new Error(String(e)));
  });
  ws.on("close", () => keepAlive && clearInterval(keepAlive));

  return {
    send(mulaw) {
      if (ws.readyState === WebSocket.OPEN) ws.send(mulaw);
      else if (ws.readyState === WebSocket.CONNECTING) pending.push(mulaw);
    },
    close() {
      if (closed) return;
      closed = true;
      pending.length = 0;
      if (keepAlive) clearInterval(keepAlive);
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => ws.terminate(), 500);
    },
  };
}
