"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Aperçu audio d'une voix.
 *
 * - Si un `provider` + `externalVoiceId` sont fournis ET qu'une clé provider
 *   est configurée côté serveur, on lit le vrai audio (ElevenLabs / Cartesia /
 *   OpenAI) via /api/voices/preview.
 * - Sinon, repli sur la synthèse du navigateur (Web Speech) en appliquant la
 *   signature de la voix : hauteur (`pitch`), débit (`speed`) et genre.
 */
export function VoicePreview({
  text,
  language,
  speed,
  pitch = 0,
  gender,
  provider,
  externalVoiceId,
  label = "Écouter un échantillon",
}: {
  text: string;
  language: string;
  speed: number;
  pitch?: number;
  gender?: string | null;
  provider?: string;
  externalVoiceId?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [supported, setSupported] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }

  const sample =
    text?.trim() ||
    "Bonjour, je suis votre agent vocal. Comment puis-je vous aider ?";

  function browserSpeak() {
    if (!supported) {
      setState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sample);
    u.lang = language || "fr-FR";
    u.rate = Math.min(Math.max(speed, 0.5), 1.5);
    u.pitch = Math.min(Math.max(1 + pitch / 12, 0), 2);
    const voices = window.speechSynthesis.getVoices();
    const prefix = (language || "fr").slice(0, 2).toLowerCase();
    const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix));
    const pool = inLang.length ? inLang : voices;
    let chosen = pool[0];
    if (gender) {
      const fem = /amelie|amélie|audrey|marie|julie|virginie|chlo|lea|léa|hortense|female|femme|woman/i;
      const masc = /thomas|nicolas|paul|henri|daniel|male|homme|\bman\b/i;
      const rx = gender === "feminine" ? fem : gender === "masculine" ? masc : null;
      if (rx) chosen = pool.find((v) => rx.test(v.name)) ?? chosen;
    }
    if (chosen) u.voice = chosen;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    setState("playing");
    window.speechSynthesis.speak(u);
  }

  async function play() {
    stopAll();
    // Voix provider « par ID » : tente l'audio réel d'abord.
    if (provider && externalVoiceId) {
      setState("loading");
      try {
        const res = await fetch("/api/voices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            voiceId: externalVoiceId,
            text: sample,
            language,
          }),
        });
        const data = await res.json();
        if (data.audio) {
          const audio = new Audio(data.audio);
          audioRef.current = audio;
          audio.onended = () => setState("idle");
          audio.onerror = () => setState("idle");
          setState("playing");
          await audio.play();
          return;
        }
      } catch {
        /* repli navigateur */
      }
    }
    browserSpeak();
  }

  function stop() {
    stopAll();
    setState("idle");
  }

  if (!supported && !provider) {
    return (
      <p className="text-xs text-muted-foreground">
        L'écoute n'est pas supportée par ce navigateur.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={state === "idle" ? play : stop}
      disabled={state === "loading"}
    >
      {state === "loading" ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Génération…
        </>
      ) : state === "playing" ? (
        <>
          <Square className="size-3.5" /> Arrêter
        </>
      ) : (
        <>
          <Volume2 className="size-4" /> {label}
        </>
      )}
    </Button>
  );
}
