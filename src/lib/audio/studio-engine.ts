"use client";

/**
 * Moteur audio du Studio Voix.
 * Enregistrement micro réel (MediaRecorder), graphe de traitement Web Audio
 * (pitch, débit, gain, égaliseur 3 bandes, réverb à convolution, compression)
 * et synthèse vocale (SpeechSynthesis) partageant les mêmes réglages.
 *
 * Tout est strictement côté navigateur : aucune dépendance, aucun coût.
 */

export interface VoiceSettings {
  /** Hauteur en demi-tons, -12..12. */
  pitch: number;
  /** Débit de lecture, 0.5..1.5. */
  rate: number;
  /** Volume / gain de sortie, 0..2. */
  gain: number;
  /** Graves (low-shelf @ 250 Hz), dB -18..18. */
  eqLow: number;
  /** Médiums (peaking @ 1.6 kHz), dB -18..18. */
  eqMid: number;
  /** Aigus (high-shelf @ 6 kHz), dB -18..18. */
  eqHigh: number;
  /** Réverbération (proportion humide), 0..1. */
  reverb: number;
  /** Compression (0 = aucune, 1 = forte). */
  compression: number;
  /** Voix système choisie pour la synthèse (voiceURI). */
  voiceURI?: string;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  pitch: 0,
  rate: 1,
  gain: 1,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  reverb: 0,
  compression: 0,
};

type Win = Window & { webkitAudioContext?: typeof AudioContext };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Génère une réponse impulsionnelle (réverb) décroissante. */
function makeImpulse(ctx: BaseAudioContext, seconds = 2.4, decay = 3): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // bruit décroissant exponentiellement
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/** Construit la chaîne de traitement entre une source et une destination. */
function buildChain(
  ctx: BaseAudioContext,
  source: AudioNode,
  settings: VoiceSettings,
  destination: AudioNode,
) {
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 250;
  low.gain.value = clamp(settings.eqLow, -18, 18);

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1600;
  mid.Q.value = 0.9;
  mid.gain.value = clamp(settings.eqMid, -18, 18);

  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 6000;
  high.gain.value = clamp(settings.eqHigh, -18, 18);

  const comp = ctx.createDynamicsCompressor();
  const amount = clamp(settings.compression, 0, 1);
  comp.threshold.value = -18 - amount * 24; // -18 .. -42 dB
  comp.knee.value = 24;
  comp.ratio.value = 1 + amount * 11; // 1 .. 12
  comp.attack.value = 0.004;
  comp.release.value = 0.25;

  const master = ctx.createGain();
  master.gain.value = clamp(settings.gain, 0, 2);

  // Voie sèche + voie humide (réverb) mélangées
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const wetAmount = clamp(settings.reverb, 0, 1);
  dry.gain.value = 1 - wetAmount * 0.65;
  wet.gain.value = wetAmount;

  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx);

  // source -> EQ -> compresseur -> (dry | convolver->wet) -> master -> destination
  source.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(comp);
  comp.connect(dry);
  comp.connect(convolver);
  convolver.connect(wet);
  dry.connect(master);
  wet.connect(master);
  master.connect(destination);

  return master;
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private current: AudioBufferSourceNode | null = null;
  /** Analyseur partagé pour dessiner la forme d'onde / le niveau. */
  analyser: AnalyserNode | null = null;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as Win).webkitAudioContext;
      this.ctx = new Ctor!();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  static isRecordingSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window !== "undefined" &&
      "MediaRecorder" in window
    );
  }

  /** Démarre l'enregistrement micro et branche l'analyseur sur l'entrée. */
  async startRecording(): Promise<void> {
    const ctx = this.ensureCtx();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    this.analyser = analyser;

    const mime = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  /** Arrête l'enregistrement et renvoie le clip (blob + data URL). */
  stopRecording(): Promise<{ blob: Blob; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) return reject(new Error("Aucun enregistrement en cours"));
      rec.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: rec.mimeType || "audio/webm",
        });
        this.teardownStream();
        const reader = new FileReader();
        reader.onload = () => resolve({ blob, dataUrl: reader.result as string });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      };
      rec.stop();
    });
  }

  cancelRecording(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* noop */
    }
    this.teardownStream();
  }

  private teardownStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }

  /** Décode un data URL / blob URL en AudioBuffer. */
  async decode(url: string): Promise<AudioBuffer> {
    const ctx = this.ensureCtx();
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  }

  /** Joue un AudioBuffer à travers le graphe de traitement. */
  play(buffer: AudioBuffer, settings: VoiceSettings, onEnded?: () => void): void {
    const ctx = this.ensureCtx();
    this.stop();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clamp(settings.rate, 0.5, 1.5);
    try {
      source.detune.value = clamp(settings.pitch, -12, 12) * 100; // demi-tons -> cents
    } catch {
      /* detune non supporté : ignoré */
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    this.analyser = analyser;
    const master = buildChain(ctx, source, settings, analyser);
    analyser.connect(ctx.destination);
    void master;
    source.onended = () => {
      if (this.current === source) this.current = null;
      onEnded?.();
    };
    this.current = source;
    source.start();
  }

  stop(): void {
    if (this.current) {
      try {
        this.current.stop();
      } catch {
        /* déjà arrêté */
      }
      this.current = null;
    }
  }

  /** Synthèse vocale appliquant le sous-ensemble de réglages compatible TTS. */
  speak(
    text: string,
    settings: VoiceSettings,
    lang = "fr-FR",
    onEnd?: () => void,
  ): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = clamp(settings.rate, 0.5, 1.5);
    // demi-tons -> facteur de hauteur SpeechSynthesis (0..2, neutre = 1)
    u.pitch = clamp(1 + settings.pitch / 12, 0, 2);
    u.volume = clamp(settings.gain, 0, 1);
    const voices = window.speechSynthesis.getVoices();
    const chosen =
      voices.find((v) => v.voiceURI === settings.voiceURI) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2)));
    if (chosen) u.voice = chosen;
    if (onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  }

  stopSpeaking(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  dispose(): void {
    this.stop();
    this.stopSpeaking();
    this.cancelRecording();
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = null;
    this.analyser = null;
  }
}
