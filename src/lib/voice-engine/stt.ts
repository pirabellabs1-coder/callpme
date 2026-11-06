/**
 * Transcription en temps réel (STT) — Deepgram, en streaming WebSocket.
 *
 * Entrée : audio µ-law 8 kHz (format téléphonique). Sortie : événements
 * « parole détectée », transcriptions intermédiaires et finales, fin de tour.
 * Le modèle et la langue sont configurables (DEEPGRAM_MODEL, défaut nova-2 ;
 * langue de l'agent, défaut fr).
 */
import WebSocket from "ws";

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

export function openDeepgram(language: string, events: SttEvents): SttStream {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY manquant : la transcription est indisponible.");
  const params = new URLSearchParams({
    model: process.env.DEEPGRAM_MODEL || "nova-2",
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
  const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
    headers: { Authorization: `Token ${key}` },
  });
  const pending: Buffer[] = [];
  let keepAlive: NodeJS.Timeout | null = null;

  ws.on("open", () => {
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

  ws.on("error", (e) => events.onError?.(e instanceof Error ? e : new Error(String(e))));
  ws.on("close", () => keepAlive && clearInterval(keepAlive));

  return {
    send(mulaw) {
      if (ws.readyState === WebSocket.OPEN) ws.send(mulaw);
      else if (ws.readyState === WebSocket.CONNECTING) pending.push(mulaw);
    },
    close() {
      if (keepAlive) clearInterval(keepAlive);
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => ws.terminate(), 500);
    },
  };
}
