"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { Play, Pause, Square, Download, Loader2, AudioLines } from "lucide-react";
import type { TranscriptTurn } from "@/lib/shared/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Gender = "feminine" | "masculine" | "neutral" | null;

interface PuterTTS {
  ai?: {
    txt2speech?: (
      text: string,
      opts: { voice?: string; language?: string; engine?: string },
    ) => Promise<HTMLAudioElement>;
  };
}
function getPuter(): PuterTTS | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { puter?: PuterTTS }).puter ?? null;
}

/** Voix AWS Polly (via Puter) selon le genre + la langue. */
function pollyVoice(gender: Gender, language: string): string {
  const fr = (language || "fr-FR").startsWith("fr");
  if (gender === "masculine") return fr ? "Mathieu" : "Matthew";
  return fr ? "Lea" : "Joanna";
}

/** Genre « opposé » pour distinguer l'appelant de l'agent. */
function otherGender(g: Gender): Gender {
  return g === "masculine" ? "feminine" : "masculine";
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Encode un AudioBuffer mono en WAV PCM 16 bits. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

/** Downmix d'un AudioBuffer en Float32 mono. */
function toMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < data.length; i++) out[i] += data[i] / buf.numberOfChannels;
  }
  return out;
}

interface Spoken {
  speaker: "agent" | "caller";
  text: string;
}

const MAX_TURNS = 60;

export function CallAudio({
  callId,
  turns,
  agentGender,
  language,
}: {
  callId: string;
  turns: TranscriptTurn[];
  agentGender: Gender;
  language: string;
}) {
  const spoken = useMemo<Spoken[]>(
    () =>
      turns
        .filter((t) => (t.speaker === "agent" || t.speaker === "caller") && t.text.trim())
        .slice(0, MAX_TURNS)
        .map((t) => ({ speaker: t.speaker as "agent" | "caller", text: t.text.trim() })),
    [turns],
  );

  const [state, setState] = useState<"idle" | "loading" | "ready" | "playing" | "paused" | "fallback">("idle");
  const [progress, setProgress] = useState(0); // synthèse 0..1
  const [pos, setPos] = useState(0); // lecture, secondes
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [truncated] = useState(
    turns.filter((t) => t.speaker === "agent" || t.speaker === "caller").length > MAX_TURNS,
  );

  const ctxRef = useRef<AudioContext | null>(null);
  const bufRef = useRef<AudioBuffer | null>(null);
  const monoRef = useRef<Float32Array | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0); // ctx.currentTime au démarrage
  const offsetRef = useRef(0); // position de reprise
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        srcRef.current?.stop();
      } catch {
        /* déjà arrêté */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  function ensureCtx(): AudioContext {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  }

  /** Synthétise un tour via Puter et renvoie le Float32 mono (ou null). */
  async function synthMono(text: string, gender: Gender, ctx: AudioContext): Promise<Float32Array | null> {
    const p = getPuter();
    if (!p?.ai?.txt2speech) return null;
    const lang = (language || "fr-FR").startsWith("fr") ? "fr-FR" : language;
    const attempts = [
      { voice: pollyVoice(gender, lang), engine: "neural" as const },
      { voice: pollyVoice(gender, lang) },
      {},
    ];
    for (const a of attempts) {
      try {
        const audio = await p.ai.txt2speech(text.slice(0, 2500), { language: lang, ...a });
        const src = audio?.src;
        if (!src) continue;
        const arr = await (await fetch(src)).arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr.slice(0));
        return toMono(decoded);
      } catch {
        /* tente l'option suivante */
      }
    }
    return null;
  }

  /** Génère l'audio complet de l'appel (concaténation des tours). */
  async function prepare(): Promise<boolean> {
    if (bufRef.current) return true;
    setState("loading");
    setError(null);
    setProgress(0);
    const ctx = ensureCtx();
    await ctx.resume().catch(() => {});
    const gap = Math.round(ctx.sampleRate * 0.32); // 320 ms de silence
    const chunks: Float32Array[] = [];
    let ok = 0;
    for (let i = 0; i < spoken.length; i++) {
      const t = spoken[i];
      const g = t.speaker === "agent" ? agentGender : otherGender(agentGender);
      const mono = await synthMono(t.text, g, ctx);
      if (mono) {
        chunks.push(mono);
        chunks.push(new Float32Array(gap));
        ok++;
      }
      setProgress((i + 1) / spoken.length);
    }
    if (ok === 0) {
      // Puter indisponible → lecture navigateur (sans téléchargement).
      setState("fallback");
      return false;
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.length;
    }
    const audioBuf = ctx.createBuffer(1, merged.length, ctx.sampleRate);
    audioBuf.copyToChannel(merged, 0);
    bufRef.current = audioBuf;
    monoRef.current = merged;
    setDuration(audioBuf.duration);
    setState("ready");
    return true;
  }

  function tick() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const elapsed = offsetRef.current + (ctx.currentTime - startedAtRef.current);
    setPos(Math.min(elapsed, duration));
    rafRef.current = requestAnimationFrame(tick);
  }

  function startFrom(offset: number) {
    const ctx = ensureCtx();
    const buf = bufRef.current;
    if (!buf) return;
    try {
      srcRef.current?.stop();
    } catch {
      /* ignore */
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // onended se déclenche aussi sur stop() manuel ; on ne réinitialise que si fini.
      const ended = offsetRef.current + (ctx.currentTime - startedAtRef.current) >= buf.duration - 0.05;
      if (ended) {
        offsetRef.current = 0;
        setPos(0);
        setState("ready");
      }
    };
    src.start(0, Math.max(0, Math.min(offset, buf.duration - 0.01)));
    srcRef.current = src;
    startedAtRef.current = ctx.currentTime;
    offsetRef.current = offset;
    setState("playing");
    rafRef.current = requestAnimationFrame(tick);
  }

  async function onPlay() {
    if (state === "playing") return;
    if (!bufRef.current) {
      const built = await prepare();
      if (!built) {
        playFallback();
        return;
      }
    }
    startFrom(offsetRef.current);
  }

  function onPause() {
    const ctx = ctxRef.current;
    if (!ctx || state !== "playing") return;
    const elapsed = offsetRef.current + (ctx.currentTime - startedAtRef.current);
    offsetRef.current = Math.min(elapsed, duration);
    try {
      srcRef.current?.stop();
    } catch {
      /* ignore */
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setState("paused");
  }

  function onStop() {
    try {
      srcRef.current?.stop();
    } catch {
      /* ignore */
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    window.speechSynthesis?.cancel();
    offsetRef.current = 0;
    setPos(0);
    setState(bufRef.current ? "ready" : "idle");
  }

  /** Repli : lecture séquentielle via la synthèse vocale du navigateur. */
  function playFallback() {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError("La lecture audio n'est pas disponible sur ce navigateur.");
      setState("idle");
      return;
    }
    setState("playing");
    const voices = synth.getVoices();
    let i = 0;
    const next = () => {
      if (i >= spoken.length) {
        setState("fallback");
        return;
      }
      const t = spoken[i++];
      const u = new SpeechSynthesisUtterance(t.text);
      u.lang = (language || "fr-FR").startsWith("fr") ? "fr-FR" : language;
      const g = t.speaker === "agent" ? agentGender : otherGender(agentGender);
      const rx = g === "masculine" ? /thomas|paul|henri|male|homme|man/i : /lea|léa|amelie|amélie|marie|female|femme|woman/i;
      const v = voices.find((x) => x.lang?.toLowerCase().startsWith("fr") && rx.test(x.name));
      if (v) u.voice = v;
      u.rate = 1;
      u.onend = next;
      u.onerror = next;
      synth.speak(u);
    };
    next();
  }

  function download() {
    const mono = monoRef.current;
    const ctx = ctxRef.current;
    if (!mono || !ctx) return;
    const blob = encodeWav(mono, ctx.sampleRate);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appel-${callId}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  if (spoken.length === 0) return null;

  const busy = state === "loading";
  const canDownload = !!monoRef.current;
  const pct = duration > 0 ? Math.min((pos / duration) * 100, 100) : 0;

  return (
    <Card className="p-5">
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <AudioLines className="size-4 text-brand" />
          Écouter l&apos;appel
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={download}
          disabled={!canDownload || busy}
          title={canDownload ? "Télécharger l'audio (WAV)" : "Générez d'abord l'audio en cliquant sur Lecture"}
        >
          <Download className="size-4" />
          Télécharger
        </Button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Reconstitution audio de la conversation avec la voix de l&apos;agent (et une
        voix distincte pour l&apos;appelant).
      </p>

      <div className="mt-4 flex items-center gap-3">
        {state === "playing" ? (
          <Button variant="brand" size="sm" onClick={onPause} className="shrink-0">
            <Pause className="size-4" />
            Pause
          </Button>
        ) : (
          <Button variant="brand" size="sm" onClick={onPlay} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {busy ? "Génération…" : state === "paused" ? "Reprendre" : "Lecture"}
          </Button>
        )}
        {(state === "playing" || state === "paused") && (
          <Button variant="outline" size="sm" onClick={onStop} className="shrink-0">
            <Square className="size-4" />
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-150"
              style={{ width: `${busy ? progress * 100 : pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[0.7rem] tabular text-muted-foreground">
            <span>
              {busy
                ? `Génération de l'audio… ${Math.round(progress * spoken.length)}/${spoken.length}`
                : fmt(pos)}
            </span>
            {!busy && duration > 0 && <span>{fmt(duration)}</span>}
          </div>
        </div>
      </div>

      {state === "fallback" && (
        <p className="mt-3 text-xs text-amber-600">
          Audio lu via la synthèse du navigateur (service de voix indisponible) — le
          téléchargement n&apos;est pas possible dans ce mode.
        </p>
      )}
      {truncated && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Seuls les {MAX_TURNS} premiers tours de parole sont inclus dans l&apos;audio.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </Card>
  );
}
