/**
 * Transcription « par phrase » pour les fournisseurs sans streaming.
 *
 * Beaucoup de modèles qui comprennent les langues locales (yoruba, twi,
 * wolof…) ne s'utilisent qu'en envoyant un fichier audio. Cet adaptateur
 * détecte lui-même le début et la fin de la parole de l'appelant (énergie du
 * signal), découpe chaque phrase, l'envoie au fournisseur et restitue les mêmes
 * événements que le flux Deepgram : le reste du moteur ne voit pas la différence.
 *
 * Prix à payer : pas de transcription intermédiaire, et la réponse arrive après
 * la fin de la phrase + le temps de l'API (≈ 0,5 à 1,5 s selon le fournisseur).
 */
import { decodeMulaw, mulawRms, wavFromPcm16 } from "./audio";
import type { SttEvents, SttStream } from "./stt";

/** Envoie une phrase (WAV PCM 16 bits 8 kHz mono) et renvoie le texte reconnu. */
export type BatchTranscriber = (wav: Buffer, signal: AbortSignal) => Promise<string>;

export interface UtteranceOptions {
  /** Énergie RMS (0..1) au-dessus de laquelle une trame est de la parole. */
  threshold?: number;
  /** Trames de 20 ms de parole consécutives avant de signaler « parole détectée ». */
  startFrames?: number;
  /** Silence (ms) qui clôt une phrase. */
  endSilenceMs?: number;
  /** Une phrase plus longue est envoyée telle quelle (ms). */
  maxUtteranceMs?: number;
  /** Audio gardé avant le début détecté, pour ne pas couper la première syllabe (ms). */
  preRollMs?: number;
  /** Phrases plus courtes ignorées (toux, bruit) (ms). */
  minUtteranceMs?: number;
  /** Délai maximal d'une transcription (ms) : au-delà, la phrase est abandonnée et la file continue. */
  timeoutMs?: number;
}

const FRAME = 160; // 20 ms à 8 kHz
const MS_PER_FRAME = 20;

export function openUtteranceStt(transcribe: BatchTranscriber, events: SttEvents, opts: UtteranceOptions = {}): SttStream {
  const threshold = opts.threshold ?? Number(process.env.VOICE_VAD_THRESHOLD || 0.02);
  const startFrames = opts.startFrames ?? 3;
  const endFrames = Math.ceil((opts.endSilenceMs ?? 700) / MS_PER_FRAME);
  const maxFrames = Math.ceil((opts.maxUtteranceMs ?? 15000) / MS_PER_FRAME);
  const preFrames = Math.ceil((opts.preRollMs ?? 200) / MS_PER_FRAME);
  const minFrames = Math.ceil((opts.minUtteranceMs ?? 250) / MS_PER_FRAME);
  const timeoutMs = opts.timeoutMs ?? 8000;

  const ctrl = new AbortController();
  let closed = false;
  let carry = Buffer.alloc(0);
  const preRoll: Buffer[] = [];
  let speech: Buffer[] = [];
  let voicedRun = 0;
  /** Trames réellement parlées de la phrase en cours (le pré-enregistrement n'en fait pas partie). */
  let voicedCount = 0;
  let silentRun = 0;
  let inSpeech = false;
  // Les phrases sont transcrites dans l'ordre, l'une après l'autre.
  let queue: Promise<void> = Promise.resolve();

  const flush = () => {
    const voicedFrames = voicedCount;
    const chunk = speech;
    speech = [];
    inSpeech = false;
    silentRun = 0;
    voicedRun = 0;
    voicedCount = 0;
    if (voicedFrames < minFrames) return;
    const wav = wavFromPcm16(decodeMulaw(Buffer.concat(chunk)));
    queue = queue.then(async () => {
      if (closed) return;
      try {
        // Un fournisseur muet ne doit pas bloquer les phrases suivantes.
        const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(timeoutMs)]);
        const text = (await transcribe(wav, signal)).trim();
        if (closed) return;
        if (text) events.onTranscript?.(text, true);
        events.onUtteranceEnd?.();
      } catch (e) {
        if (!closed) events.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    });
  };

  const onFrame = (frame: Buffer) => {
    const voiced = mulawRms(frame) >= threshold;
    if (!inSpeech) {
      preRoll.push(frame);
      if (preRoll.length > preFrames + startFrames) preRoll.shift();
      voicedRun = voiced ? voicedRun + 1 : 0;
      if (voicedRun >= startFrames) {
        inSpeech = true;
        silentRun = 0;
        voicedCount = voicedRun;
        speech = preRoll.splice(0);
        events.onSpeechStarted?.();
      }
      return;
    }
    speech.push(frame);
    if (voiced) voicedCount++;
    silentRun = voiced ? 0 : silentRun + 1;
    if (silentRun >= endFrames || speech.length >= maxFrames) flush();
  };

  return {
    send(mulaw) {
      if (closed) return;
      const buf = carry.length ? Buffer.concat([carry, mulaw]) : mulaw;
      let i = 0;
      for (; i + FRAME <= buf.length; i += FRAME) onFrame(buf.subarray(i, i + FRAME));
      carry = Buffer.from(buf.subarray(i));
    },
    close() {
      if (closed) return;
      closed = true;
      ctrl.abort();
      speech = [];
      preRoll.length = 0;
    },
  };
}
