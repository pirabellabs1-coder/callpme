"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scène du hero : une cliente appelle, l'agent IA décroche et lui répond.
 * Entre les deux avatars, des ondes vocales circulent dans le sens de celui
 * qui parle ; l'interlocuteur actif « pulse ». En dessous, la transcription.
 * Purement illustratif. prefers-reduced-motion : scène figée, texte complet.
 */
const TURNS: { who: "caller" | "agent"; text: string }[] = [
  { who: "agent", text: "Cabinet Diallo, bonjour. Comment puis-je vous aider ?" },
  { who: "caller", text: "Bonjour, je voudrais un rendez-vous jeudi." },
  { who: "agent", text: "Jeudi, j'ai 10 h 30 ou 16 h. Qu'est-ce qui vous convient ?" },
  { who: "caller", text: "16 h, s'il vous plaît." },
  { who: "agent", text: "C'est noté. Vous allez recevoir une confirmation par SMS." },
];

const BARS = [0.3, 0.55, 0.85, 0.5, 0.95, 0.65, 0.4, 0.8, 1, 0.6, 0.45, 0.75, 0.9, 0.5, 0.35, 0.7, 0.55, 0.85, 0.4, 0.6];

export function HeroCallScene({
  callerSrc,
  agentSrc,
}: {
  callerSrc: string;
  agentSrc?: string;
}) {
  const [turn, setTurn] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduced(true);
      return;
    }
    const id = window.setInterval(() => setTurn((t) => (t + 1) % TURNS.length), 2800);
    return () => window.clearInterval(id);
  }, []);

  const speaker = TURNS[turn].who;

  return (
    <div className="w-full max-w-[520px]">
      <div className="relative">

        {/* En-tête d'appel */}
        <div className="relative mx-auto flex w-fit items-center gap-4 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-1.5 text-xs">
          <span className="flex items-center gap-2 text-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Appel en cours
          </span>
          <span className="mono text-muted-foreground">00:{String(12 + turn * 6).padStart(2, "0")}</span>
        </div>

        {/* Les deux interlocuteurs et les ondes entre eux */}
        <div className="relative mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-1" aria-hidden>
          <Avatar
            src={callerSrc}
            alt=""
            label="Cliente"
            active={speaker === "caller"}
            reduced={reduced}
          />

          <VoiceBridge direction={speaker === "caller" ? "right" : "left"} reduced={reduced} />

          <Avatar
            src={agentSrc}
            alt=""
            label="Agent Callpme"
            active={speaker === "agent"}
            reduced={reduced}
            fallback={<RobotFallback />}
            brand
          />
        </div>

        {/* Onde vocale en bas */}
        <div aria-hidden className="relative mt-8 flex h-14 items-center justify-center gap-1">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-1 rounded-full transition-colors duration-500",
                speaker === "agent" ? "bg-brand" : "bg-foreground/70",
                !reduced && "animate-wave",
              )}
              style={{ height: `${h * 48}px`, animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        {/* Transcription (lisible par les lecteurs d'écran) */}
        <div className="relative mt-6 min-h-[64px]" aria-live="off">
          <p className="sr-only">
            Exemple de conversation entre une cliente et l'agent vocal Callpme :{" "}
            {TURNS.map((t) => `${t.who === "agent" ? "Agent" : "Cliente"} : ${t.text}`).join(" ")}
          </p>
          <p
            key={turn}
            aria-hidden
            className={cn(
              "mx-auto w-fit max-w-full animate-fade-up rounded-2xl px-5 py-3 text-center text-[15px] leading-relaxed text-foreground",
              speaker === "agent" ? "bg-brand/[0.12]" : "bg-foreground/[0.06]",
            )}
          >
            <span className="mr-1.5 text-xs text-muted-foreground">
              {speaker === "agent" ? "Agent" : "Cliente"}
            </span>
            {TURNS[turn].text}
          </p>
        </div>
      </div>
    </div>
  );
}

function Avatar({
  src,
  alt,
  label,
  active,
  reduced,
  fallback,
  brand = false,
}: {
  src?: string;
  alt: string;
  label: string;
  active: boolean;
  reduced: boolean;
  fallback?: React.ReactNode;
  brand?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Signaux qui « sortent » de l'interlocuteur actif */}
        {active && !reduced && (
          <>
            <span className={cn("absolute inset-0 animate-ping rounded-full", brand ? "bg-brand/25" : "bg-foreground/15")} style={{ animationDuration: "1.6s" }} />
            <span className={cn("absolute -inset-3 rounded-full border", brand ? "border-brand/30" : "border-foreground/15")} />
          </>
        )}
        <div
          className={cn(
            "relative size-28 overflow-hidden rounded-full ring-1 transition-all duration-500 ease-spring sm:size-36 xl:size-44",
            active ? (brand ? "scale-105 ring-2 ring-brand shadow-brand" : "scale-105 ring-2 ring-foreground/60") : "scale-95 opacity-75 ring-border",
          )}
        >
          {src ? (
            <Image src={src} alt={alt} fill sizes="(min-width: 1280px) 176px, 144px" className="object-cover object-[54%_40%] scale-[1.35]" priority />
          ) : (
            fallback
          )}
        </div>
      </div>
      <span className={cn("mt-4 text-sm transition-colors", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}

/** Ondes vocales animées entre les deux avatars, dans le sens de la parole. */
function VoiceBridge({ direction, reduced }: { direction: "left" | "right"; reduced: boolean }) {
  const toRight = direction === "right";
  return (
    <svg viewBox="0 0 120 60" className="h-12 w-14 sm:h-16 sm:w-20" fill="none">
      {[
        { amp: 16, op: 1, w: 2 },
        { amp: 10, op: 0.55, w: 1.5 },
        { amp: 22, op: 0.3, w: 1 },
      ].map((l, i) => (
        <path
          key={i}
          d={`M0 30 C 15 ${30 - l.amp}, 30 ${30 + l.amp}, 45 30 S 75 ${30 - l.amp}, 90 30 S 105 ${30 + l.amp}, 120 30`}
          stroke={toRight ? "hsl(var(--foreground))" : "hsl(var(--brand))"}
          strokeOpacity={l.op}
          strokeWidth={l.w}
          strokeLinecap="round"
          strokeDasharray="6 10"
          style={
            reduced
              ? undefined
              : {
                  animation: `${toRight ? "dash-right" : "dash-left"} ${0.9 + i * 0.3}s linear infinite`,
                  transition: "stroke 500ms",
                }
          }
        />
      ))}
      <style>{`
        @keyframes dash-right { to { stroke-dashoffset: -32; } }
        @keyframes dash-left { to { stroke-dashoffset: 32; } }
      `}</style>
    </svg>
  );
}

/** Robot dessiné en SVG (utilisé tant qu'aucune image d'agent n'est fournie). */
function RobotFallback() {
  return (
    <svg viewBox="0 0 128 128" className="size-full" role="presentation">
      <defs>
        <radialGradient id="rb-bg" cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="hsl(30 5% 16%)" />
          <stop offset="1" stopColor="hsl(30 6% 6%)" />
        </radialGradient>
        <linearGradient id="rb-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f1ea" />
          <stop offset="1" stopColor="#c9c1b6" />
        </linearGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1b1d" />
          <stop offset="1" stopColor="#09090a" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" fill="url(#rb-bg)" />
      {/* épaules */}
      <path d="M22 128c4-22 20-32 42-32s38 10 42 32z" fill="#2a2a2d" />
      <path d="M40 112h48" stroke="#E8572A" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
      {/* cou */}
      <rect x="54" y="84" width="20" height="14" rx="4" fill="#3a3a3e" />
      {/* tête */}
      <rect x="30" y="26" width="68" height="62" rx="26" fill="url(#rb-head)" />
      <rect x="38" y="40" width="52" height="30" rx="15" fill="url(#rb-visor)" />
      {/* yeux */}
      <g className="origin-center animate-[blink_4s_ease-in-out_infinite]" style={{ transformBox: "fill-box" }}>
        <rect x="49" y="50" width="10" height="10" rx="5" fill="#E8572A" />
        <rect x="69" y="50" width="10" height="10" rx="5" fill="#E8572A" />
      </g>
      <path d="M56 64q8 5 16 0" stroke="#E8572A" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* casque micro */}
      <path d="M30 56c-6 0-8 4-8 9" stroke="#3a3a3e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M24 66c2 10 12 14 26 12" stroke="#3a3a3e" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="51" cy="78" r="3.5" fill="#E8572A" />
      {/* antenne */}
      <path d="M64 26v-10" stroke="#c9c1b6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="64" cy="13" r="4" fill="#E8572A" />
    </svg>
  );
}
