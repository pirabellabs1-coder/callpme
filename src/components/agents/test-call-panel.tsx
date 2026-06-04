"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Loader2,
  Sparkles,
  CircleDot,
  ArrowRight,
  Wrench,
  Timer,
} from "lucide-react";
import type { AgentRole, FirstSpeaker } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";

type Status =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "ended";

interface Turn {
  speaker: "agent" | "caller" | "tool";
  text: string;
  at: number;
  toolName?: string;
}

/** Profil voix appliqué à la synthèse (issu de la config + Studio Voix). */
export interface VoiceProfile {
  rate: number;
  pitch?: number;
  gain?: number;
  voiceURI?: string;
  /** Voix « par ID » d'un provider premium (audio réel si clé configurée). */
  provider?: string;
  externalVoiceId?: string;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Choisit une voix système selon le voiceURI, le genre, puis la langue. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  langPrefix: string,
  gender: string | null,
  voiceURI?: string,
): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const exact = voices.find((v) => v.voiceURI === voiceURI);
    if (exact) return exact;
  }
  const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(langPrefix));
  const pool = inLang.length ? inLang : voices;
  if (gender) {
    const fem = /amelie|amélie|audrey|marie|julie|virginie|chlo|lea|léa|female|femme|woman/i;
    const masc = /thomas|nicolas|paul|henri|daniel|male|homme|\bman\b/i;
    const rx = gender === "feminine" ? fem : gender === "masculine" ? masc : null;
    if (rx) {
      const match = pool.find((v) => rx.test(v.name));
      if (match) return match;
    }
  }
  return pool[0];
}

export function TestCallPanel({
  agentId,
  agentName,
  role,
  roleLabel,
  firstMessage,
  firstSpeaker,
  language,
  liveMode,
  modelLabel,
  voiceProfile,
  voiceGender,
  maxDurationSec,
}: {
  agentId: string;
  agentName: string;
  role: AgentRole;
  roleLabel?: string;
  firstMessage: string;
  firstSpeaker: FirstSpeaker;
  language: string;
  liveMode: boolean;
  modelLabel: string;
  voiceProfile?: VoiceProfile;
  voiceGender?: string | null;
  maxDurationSec?: number;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [input, setInput] = useState("");
  const [savedCallId, setSavedCallId] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);

  const activeRef = useRef(false);
  const statusRef = useRef<Status>("idle");
  const elapsedRef = useRef(0);
  const messagesRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const recogRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setStat = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Détection du support micro + init reconnaissance vocale
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: any;
      webkitSpeechRecognition?: any;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (SR) {
      setMicSupported(true);
      const r = new SR();
      r.lang = language;
      r.interimResults = false;
      r.continuous = false;
      r.maxAlternatives = 1;
      r.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript?.trim();
        if (text) handleCaller(text);
      };
      r.onerror = () => {
        if (activeRef.current && statusRef.current === "listening") {
          // silence/erreur : on attend une action manuelle
          setStat("listening");
        }
      };
      recogRef.current = r;
    }
    return () => {
      try {
        recogRef.current?.abort?.();
      } catch {}
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Timer d'appel + coupure automatique à la durée maximale configurée
  useEffect(() => {
    if (status === "idle" || status === "ended") return;
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (
        maxDurationSec &&
        maxDurationSec > 0 &&
        elapsedRef.current >= maxDurationSec &&
        activeRef.current
      ) {
        void endAtLimit();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, maxDurationSec]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, status]);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }

  function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      void speakImpl(text, resolve);
    });
  }

  async function speakImpl(text: string, resolve: () => void) {
    stopAudio();
    // Voix « par ID » d'un provider premium : audio réel si une clé existe.
    if (voiceProfile?.provider && voiceProfile?.externalVoiceId) {
      try {
        const res = await fetch("/api/voices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: voiceProfile.provider,
            voiceId: voiceProfile.externalVoiceId,
            text,
            language,
          }),
        });
        const data = await res.json();
        if (data.audio) {
          const audio = new Audio(data.audio);
          audioRef.current = audio;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          await audio.play().catch(() => resolve());
          return;
        }
      } catch {
        /* repli synthèse navigateur */
      }
    }
    // Repli : synthèse du navigateur avec la signature de la voix.
    if (!("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    u.rate = clamp(voiceProfile?.rate ?? 1, 0.5, 1.5);
    const pitch =
      voiceProfile?.pitch ??
      (voiceGender === "masculine" ? -3 : voiceGender === "feminine" ? 2 : 0);
    u.pitch = clamp(1 + pitch / 12, 0, 2);
    if (voiceProfile?.gain != null) u.volume = clamp(voiceProfile.gain, 0, 1);
    const voices = window.speechSynthesis.getVoices();
    const v = pickVoice(
      voices,
      language.slice(0, 2).toLowerCase(),
      voiceGender ?? null,
      voiceProfile?.voiceURI,
    );
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  }

  function startListening() {
    if (!recogRef.current || !activeRef.current) return;
    setStat("listening");
    try {
      recogRef.current.start();
    } catch {
      /* déjà démarré */
    }
  }

  async function agentSay(text: string) {
    setTurns((t) => [...t, { speaker: "agent", text, at: elapsedRef.current }]);
    messagesRef.current.push({ role: "assistant", content: text });
    setStat("speaking");
    await speak(text);
  }

  async function fetchReply(): Promise<{
    reply: string;
    toolCalls: { name: string; message: string }[];
  }> {
    const res = await fetch(`/api/agents/${agentId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesRef.current }),
    });
    const data = await res.json();
    return {
      reply: data.reply ?? "Pardon, pouvez-vous répéter ?",
      toolCalls: Array.isArray(data.toolCalls) ? data.toolCalls : [],
    };
  }

  async function handleCaller(text: string) {
    if (!activeRef.current) return;
    setTurns((t) => [...t, { speaker: "caller", text, at: elapsedRef.current }]);
    messagesRef.current.push({ role: "user", content: text });
    setStat("thinking");
    try {
      const { reply, toolCalls } = await fetchReply();
      if (!activeRef.current) return;
      // Les outils réellement déclenchés apparaissent dans le transcript.
      for (const tc of toolCalls) {
        setTurns((t) => [
          ...t,
          { speaker: "tool", text: tc.message, at: elapsedRef.current, toolName: tc.name },
        ]);
      }
      await agentSay(reply);
    } catch {
      if (activeRef.current) await agentSay("Désolé, un problème technique. Pouvez-vous répéter ?");
    }
    if (activeRef.current) startListening();
  }

  async function endAtLimit() {
    if (!activeRef.current) return;
    activeRef.current = false; // empêche les déclenchements répétés
    try {
      recogRef.current?.abort?.();
    } catch {}
    setTurns((t) => [
      ...t,
      {
        speaker: "agent",
        text: "Le temps imparti pour cet appel est atteint, je dois conclure. Merci de votre appel et à très bientôt !",
        at: elapsedRef.current,
      },
    ]);
    await speak(
      "Le temps imparti pour cet appel est atteint, je dois conclure. Merci de votre appel et à très bientôt !",
    );
    await endCall();
  }

  async function startCall() {
    activeRef.current = true;
    elapsedRef.current = 0;
    setElapsed(0);
    setTurns([]);
    setSavedCallId(null);
    messagesRef.current = [];
    if (firstSpeaker === "agent") {
      await agentSay(firstMessage || "Bonjour, comment puis-je vous aider ?");
    }
    if (activeRef.current) startListening();
  }

  async function endCall() {
    activeRef.current = false;
    try {
      recogRef.current?.abort?.();
    } catch {}
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopAudio();
    setStat("ended");
    // Journalise l'appel de test
    if (turns.length > 0) {
      try {
        const res = await fetch(`/api/agents/${agentId}/test-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationSec: elapsedRef.current,
            transcript: turns
              .filter((t) => t.speaker !== "tool")
              .map((t) => ({
                speaker: t.speaker,
                text: t.text,
                at: t.at,
              })),
          }),
        });
        const data = await res.json();
        if (res.ok) setSavedCallId(data.callId);
      } catch {
        /* ignore */
      }
    }
  }

  function sendText(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeRef.current) return;
    setInput("");
    try {
      recogRef.current?.abort?.();
    } catch {}
    handleCaller(text);
  }

  const active = status !== "idle" && status !== "ended";
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  const statusLabel =
    status === "listening"
      ? "À vous de parler…"
      : status === "thinking"
        ? "L'agent réfléchit…"
        : status === "speaking"
          ? "L'agent parle…"
          : status === "ended"
            ? "Appel terminé"
            : "Prêt";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-5 py-4">
        <RoleIcon role={role} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-tight text-foreground">
            {agentName}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <RoleBadge role={role} label={roleLabel} />
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
              <Sparkles className="size-3" />
              {modelLabel}
            </span>
          </div>
        </div>
        {active && (
          <span className="mono inline-flex items-center gap-1.5 text-sm text-foreground">
            <CircleDot className="size-3.5 animate-pulse text-brand" />
            {mm}:{ss}
          </span>
        )}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="h-80 space-y-3 overflow-y-auto px-5 py-4">
        {turns.length === 0 && status === "idle" && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand ring-1 ring-inset ring-brand-600/15">
              <Phone className="size-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">
              Testez votre agent en direct
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {firstSpeaker === "agent"
                ? "L'agent décrochera et vous parlera. Répondez au micro ou au clavier."
                : "Lancez l'appel puis parlez : l'agent vous écoute en premier."}
            </p>
          </div>
        )}
        {turns.map((t, i) =>
          t.speaker === "tool" ? (
            <div key={i} className="flex justify-center">
              <span className="inline-flex max-w-[88%] items-center gap-1.5 rounded-full border border-brand/20 bg-brand-50/60 px-3 py-1 text-[0.72rem] text-brand-700">
                <Wrench className="size-3 shrink-0" strokeWidth={2} />
                <span className="font-mono font-medium">{t.toolName}</span>
                <span className="text-brand/40">·</span>
                <span className="truncate font-normal text-muted-foreground">
                  {t.text}
                </span>
              </span>
            </div>
          ) : (
            <div
              key={i}
              className={cn(
                "flex items-end gap-2",
                t.speaker === "agent" ? "justify-start" : "flex-row-reverse",
              )}
            >
              {t.speaker === "agent" ? (
                <RoleIcon role={role} size="sm" className="shrink-0" />
              ) : (
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[0.7rem] font-semibold text-background">
                  Moi
                </span>
              )}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  t.speaker === "agent"
                    ? "rounded-bl-sm border border-border bg-card text-foreground"
                    : "rounded-br-sm bg-brand text-white",
                )}
              >
                {t.text}
              </div>
            </div>
          ),
        )}
        {status === "thinking" && (
          <div className="flex items-center gap-2">
            <RoleIcon role={role} size="sm" />
            <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Barre de contrôle */}
      <div className="border-t border-border bg-secondary/30 p-4">
        {status === "idle" ? (
          <Button variant="brand" className="w-full" onClick={startCall}>
            <Phone className="size-4" />
            Démarrer l'appel de test
          </Button>
        ) : status === "ended" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="brand" className="flex-1" onClick={startCall}>
              <Phone className="size-4" />
              Rappeler
            </Button>
            {savedCallId && (
              <Link
                href={`/calls/${savedCallId}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
              >
                Voir le transcript
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-medium",
                  status === "listening" ? "text-brand" : "text-muted-foreground",
                )}
              >
                {status === "listening" ? (
                  <Mic className="size-4 animate-pulse" />
                ) : status === "speaking" ? (
                  <MicOff className="size-4" />
                ) : (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {statusLabel}
              </span>
              <Button variant="destructive" size="sm" onClick={endCall}>
                <PhoneOff className="size-4" />
                Terminer
              </Button>
            </div>
            <form onSubmit={sendText} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  micSupported
                    ? "Parlez au micro, ou tapez ici…"
                    : "Tapez votre message (micro non supporté)…"
                }
                className="h-10 flex-1 rounded-lg border border-input bg-card px-3 text-sm shadow-xs focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
              />
              <Button type="submit" variant="default" size="icon" aria-label="Envoyer">
                <Send className="size-4" />
              </Button>
              {micSupported && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={startListening}
                  aria-label="Réécouter"
                >
                  <Mic className="size-4" />
                </Button>
              )}
            </form>
            {!micSupported && (
              <p className="text-xs text-muted-foreground">
                Le micro (reconnaissance vocale) est supporté sur Chrome et Edge.
                Vous pouvez tester au clavier ici.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
