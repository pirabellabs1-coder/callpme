"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Lecture d'un échantillon audio (aperçu d'une voix). Un seul aperçu joue à la fois. */
let current: HTMLAudioElement | null = null;

export function SamplePlayButton({ src, label, className }: { src: string; label: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle(e: React.MouseEvent) {
    // Dans une carte cliquable : ne pas sélectionner la voix en l'écoutant.
    e.preventDefault();
    e.stopPropagation();
    if (playing) {
      audio.current?.pause();
      return;
    }
    if (!audio.current) {
      const a = new Audio(src);
      a.onplay = () => setPlaying(true);
      a.onpause = () => setPlaying(false);
      a.onended = () => setPlaying(false);
      a.onerror = () => setPlaying(false);
      audio.current = a;
    }
    if (current && current !== audio.current) current.pause();
    current = audio.current;
    audio.current.currentTime = 0;
    void audio.current.play().catch(() => setPlaying(false));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? `Arrêter ${label.replace(/^Écouter /, "")}` : label}
      aria-pressed={playing}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
        playing && "border-brand text-brand",
        className,
      )}
    >
      {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
    </button>
  );
}
