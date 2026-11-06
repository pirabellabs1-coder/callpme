"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, AudioLines } from "lucide-react";
import type { TranscriptTurn } from "@/lib/shared/types";
import { sanitizeSpoken } from "@/lib/voice/speech-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Gender = "feminine" | "masculine" | "neutral" | null;

function frLang(language: string): string {
  return (language || "fr-FR").startsWith("fr") ? "fr-FR" : language;
}
/** Genre « opposé » pour distinguer l'appelant de l'agent. */
function otherGender(g: Gender): Gender {
  return g === "masculine" ? "feminine" : "masculine";
}

interface Spoken {
  speaker: "agent" | "caller";
  text: string;
}

const MAX_TURNS = 60;

export function CallAudio({
  turns,
  agentGender,
  language,
}: {
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

  if (spoken.length === 0) return null;

  const playPct = spoken.length > 0 ? ((curTurn + (play === "idle" ? 0 : 1)) / spoken.length) * 100 : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <AudioLines className="size-4 text-brand" />
          Écouter l&apos;appel
        </h2>
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

      {truncated && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Seuls les {MAX_TURNS} premiers tours de parole sont inclus.
        </p>
      )}
    </Card>
  );
}
