"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { Play, Pause, Square, Download, Loader2, AudioLines } from "lucide-react";
import type { TranscriptTurn } from "@/lib/shared/types";
import { sanitizeSpoken } from "@/lib/voice/speech-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Gender = "feminine" | "masculine" | "neutral" | null;

interface PuterApi {
  ai?: {
    txt2speech?: (
      text: string,
      opts: { voice?: string; language?: string; engine?: string },
    ) => Promise<HTMLAudioElement>;
  };
  auth?: { signIn?: () => Promise<unknown> };
}
function getPuter(): PuterApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { puter?: PuterApi }).puter ?? null;
}

function frLang(language: string): string {
  return (language || "fr-FR").startsWith("fr") ? "fr-FR" : language;
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

function withTimeout<T>(pr: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    pr,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

/** Encode un Float32 mono en WAV PCM 16 bits. */
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
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
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
        .map((t) => ({ speaker: t.speaker as "agent" | "caller", text: sanitizeSpoken(t.text) }))
        .filter((t) => t.text.length > 0),
    [turns],
  );
  const truncated =
    turns.filter((t) => t.speaker === "agent" || t.speaker === "caller").length > MAX_TURNS;

  // Lecture (synthèse vocale du navigateur — fiable, sans dépendance externe)
  const [play, setPlay] = useState<"idle" | "playing" | "paused">("idle");
  const [curTurn, setCurTurn] = useState(0);
  const idxRef = useRef(0);
  const stoppedRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Téléchargement (génère un vrai fichier audio via le service vocal Puter)
  const [dl, setDl] = useState<"idle" | "preparing" | "error">("idle");
  const [dlProgress, setDlProgress] = useState(0);
  const [dlMsg, setDlMsg] = useState<string | null>(null);

  useEffect(() => {
    function loadVoices() {
      voicesRef.current = window.speechSynthesis?.getVoices() ?? [];
    }
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function pickVoice(gender: Gender): SpeechSynthesisVoice | undefined {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;
    const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
    const pool = fr.length ? fr : voices;
    const fem = /lea|léa|amelie|amélie|audrey|marie|julie|virginie|chlo|female|femme|woman|aurelie|aurélie/i;
    const masc = /thomas|nicolas|paul|henri|mathieu|daniel|male|homme|\bman\b/i;
    const rx = gender === "masculine" ? masc : gender === "feminine" ? fem : null;
    if (rx) {
      const m = pool.find((v) => rx.test(v.name));
      if (m) return m;
    }
    return pool[0];
  }

  function speakFrom(start: number) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    stoppedRef.current = false;
    setPlay("playing");
    const speakNext = (j: number) => {
      if (stoppedRef.current) return;
      if (j >= spoken.length) {
        setPlay("idle");
        setCurTurn(0);
        idxRef.current = 0;
        return;
      }
      idxRef.current = j;
      setCurTurn(j);
      const t = spoken[j];
      const u = new SpeechSynthesisUtterance(t.text);
      u.lang = frLang(language);
      const g = t.speaker === "agent" ? agentGender : otherGender(agentGender);
      const v = pickVoice(g);
      if (v) u.voice = v;
      u.rate = 1;
      u.pitch = g === "masculine" ? 0.9 : 1.05;
      u.onend = () => speakNext(j + 1);
      u.onerror = () => speakNext(j + 1);
      synth.speak(u);
    };
    speakNext(start);
  }

  function onPlay() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (play === "paused") {
      synth.resume();
      setPlay("playing");
      return;
    }
    if (play === "playing") return;
    synth.cancel();
    speakFrom(0);
  }
  function onPause() {
    window.speechSynthesis?.pause();
    setPlay("paused");
  }
  function onStop() {
    stoppedRef.current = true;
    window.speechSynthesis?.cancel();
    setPlay("idle");
    setCurTurn(0);
    idxRef.current = 0;
  }

  async function puterSignIn(p: PuterApi) {
    if (!p.auth?.signIn) return;
    try {
      await withTimeout(Promise.resolve(p.auth.signIn()), 60_000);
    } catch {
      /* déjà connecté ou refusé */
    }
  }

  async function synthMono(
    p: PuterApi,
    text: string,
    gender: Gender,
    ctx: AudioContext,
  ): Promise<Float32Array | null> {
    if (!p.ai?.txt2speech) return null;
    const lang = frLang(language);
    const attempts = [
      { voice: pollyVoice(gender, lang), engine: "neural" as const },
      { voice: pollyVoice(gender, lang) },
    ];
    for (const a of attempts) {
      try {
        const audio = await withTimeout(
          p.ai.txt2speech(text.slice(0, 2500), { language: lang, ...a }),
          12_000,
        );
        const src = audio?.src;
        if (!src) continue;
        const arr = await withTimeout(fetch(src).then((r) => r.arrayBuffer()), 10_000);
        const decoded = await ctx.decodeAudioData(arr.slice(0));
        return toMono(decoded);
      } catch {
        /* tente l'option suivante */
      }
    }
    return null;
  }

  async function onDownload() {
    if (dl === "preparing") return;
    setDl("preparing");
    setDlMsg(null);
    setDlProgress(0);
    const p = getPuter();
    if (!p?.ai?.txt2speech) {
      setDl("error");
      setDlMsg("Le service vocal n'est pas disponible sur cette page. Réessayez dans un instant.");
      return;
    }
    try {
      await puterSignIn(p);
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const gap = Math.round(ctx.sampleRate * 0.32);
      const chunks: Float32Array[] = [];
      let ok = 0;
      for (let i = 0; i < spoken.length; i++) {
        const t = spoken[i];
        const g = t.speaker === "agent" ? agentGender : otherGender(agentGender);
        const mono = await synthMono(p, t.text, g, ctx);
        if (mono) {
          chunks.push(mono, new Float32Array(gap));
          ok++;
        } else if (i === 0) {
          break; // le service vocal ne répond pas → on abandonne vite
        }
        setDlProgress((i + 1) / spoken.length);
      }
      if (ok === 0) {
        await ctx.close();
        throw new Error("tts-failed");
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      const blob = encodeWav(merged, ctx.sampleRate);
      await ctx.close();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `appel-${callId}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDl("idle");
    } catch {
      setDl("error");
      setDlMsg(
        "Téléchargement indisponible pour le moment (service vocal injoignable). La lecture reste disponible ci-dessus.",
      );
    }
  }

  if (spoken.length === 0) return null;

  const preparing = dl === "preparing";
  const playPct = spoken.length > 0 ? ((curTurn + (play === "idle" ? 0 : 1)) / spoken.length) * 100 : 0;

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
          onClick={onDownload}
          disabled={preparing}
          title="Télécharger l'audio de l'appel (WAV)"
        >
          {preparing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {preparing ? `Préparation… ${Math.round(dlProgress * spoken.length)}/${spoken.length}` : "Télécharger"}
        </Button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Reconstitution audio de la conversation avec la voix de l&apos;agent (et une
        voix distincte pour l&apos;appelant).
      </p>

      <div className="mt-4 flex items-center gap-3">
        {play === "playing" ? (
          <Button variant="brand" size="sm" onClick={onPause} className="shrink-0">
            <Pause className="size-4" />
            Pause
          </Button>
        ) : (
          <Button variant="brand" size="sm" onClick={onPlay} className="shrink-0">
            <Play className="size-4" />
            {play === "paused" ? "Reprendre" : "Lecture"}
          </Button>
        )}
        {play !== "idle" && (
          <Button variant="outline" size="sm" onClick={onStop} className="shrink-0">
            <Square className="size-4" />
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${play === "idle" ? 0 : playPct}%` }}
            />
          </div>
          <div className="mt-1 text-[0.7rem] tabular text-muted-foreground">
            {play === "idle"
              ? `${spoken.length} tours de parole`
              : `Lecture — tour ${curTurn + 1}/${spoken.length}`}
          </div>
        </div>
      </div>

      {dl === "error" && dlMsg && <p className="mt-3 text-xs text-amber-600">{dlMsg}</p>}
      {truncated && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Seuls les {MAX_TURNS} premiers tours de parole sont inclus.
        </p>
      )}
    </Card>
  );
}
