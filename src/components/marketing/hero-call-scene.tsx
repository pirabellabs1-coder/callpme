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

/**
 * Agent IA dessiné en SVG, rendu « 3D » : volumes par dégradés radiaux,
 * reflets spéculaires, visière laquée, yeux lumineux (halo), lumière de
 * contour orange côté droit et ombres douces. Aucune image externe.
 */
function RobotFallback() {
  return (
    <svg viewBox="0 0 160 160" className="size-full" role="presentation">
      <defs>
        <radialGradient id="rb-bg" cx="45%" cy="40%" r="75%">
          <stop offset="0" stopColor="#24221f" />
          <stop offset="1" stopColor="#0b0b0c" />
        </radialGradient>
        {/* Tête : céramique blanc chaud, lumière venant de la gauche */}
        <radialGradient id="rb-head" cx="34%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#efe8de" />
          <stop offset=".8" stopColor="#b9afa2" />
          <stop offset="1" stopColor="#7d746a" />
        </radialGradient>
        <linearGradient id="rb-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset=".7" stopColor="#E8572A" stopOpacity="0" />
          <stop offset="1" stopColor="#E8572A" stopOpacity=".75" />
        </linearGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2a2e" />
          <stop offset=".55" stopColor="#0d0d10" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <linearGradient id="rb-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".38" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="rb-ear" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#5b5a60" />
          <stop offset="1" stopColor="#1c1c20" />
        </radialGradient>
        <linearGradient id="rb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a50" />
          <stop offset="1" stopColor="#141417" />
        </linearGradient>
        <radialGradient id="rb-shade" cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id="rb-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="rb-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width="160" height="160" fill="url(#rb-bg)" />
      {/* Halo orange derrière la tête */}
      <circle cx="84" cy="66" r="52" fill="#E8572A" opacity=".10" filter="url(#rb-soft)" />

      {/* Buste */}
      <path d="M24 160c4-30 26-44 56-44s52 14 56 44z" fill="url(#rb-body)" />
      <path d="M120 128c8 8 13 18 16 32" stroke="#E8572A" strokeOpacity=".55" strokeWidth="2" fill="none" />
      <path d="M52 142h56" stroke="#E8572A" strokeOpacity=".75" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="80" cy="132" r="3" fill="#E8572A" filter="url(#rb-glow)" />

      {/* Cou + ombre portée de la tête */}
      <rect x="66" y="98" width="28" height="22" rx="8" fill="#2b2b30" />
      <ellipse cx="80" cy="104" rx="24" ry="8" fill="url(#rb-shade)" />

      {/* Oreillettes */}
      <rect x="28" y="54" width="14" height="30" rx="7" fill="url(#rb-ear)" />
      <rect x="118" y="54" width="14" height="30" rx="7" fill="url(#rb-ear)" />
      <rect x="128" y="62" width="3" height="14" rx="1.5" fill="#E8572A" opacity=".8" />

      {/* Tête */}
      <rect x="36" y="26" width="88" height="80" rx="34" fill="url(#rb-head)" />
      <rect x="36" y="26" width="88" height="80" rx="34" fill="url(#rb-rim)" />
      {/* Reflet spéculaire */}
      <ellipse cx="58" cy="40" rx="16" ry="7" fill="#fff" opacity=".7" transform="rotate(-18 58 40)" />

      {/* Visière laquée */}
      <rect x="46" y="46" width="68" height="40" rx="20" fill="url(#rb-visor)" />
      <rect x="46" y="46" width="68" height="40" rx="20" fill="none" stroke="#000" strokeOpacity=".5" />
      <path d="M54 52c10-4 34-5 48-1" stroke="url(#rb-gloss)" strokeWidth="6" strokeLinecap="round" fill="none" />

      {/* Yeux lumineux qui clignent */}
      <g className="origin-center animate-[blink_4.5s_ease-in-out_infinite]" style={{ transformBox: "fill-box" }} filter="url(#rb-glow)">
        <ellipse cx="66" cy="64" rx="6.5" ry="7.5" fill="#ff7a45" />
        <ellipse cx="94" cy="64" rx="6.5" ry="7.5" fill="#ff7a45" />
        <ellipse cx="64" cy="61" rx="2" ry="2.4" fill="#fff" opacity=".9" />
        <ellipse cx="92" cy="61" rx="2" ry="2.4" fill="#fff" opacity=".9" />
      </g>
      {/* Sourire */}
      <path d="M71 76q9 6 18 0" stroke="#ff7a45" strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#rb-glow)" />

      {/* Micro du casque */}
      <path d="M35 76c0 14 10 22 26 22" stroke="#2b2b30" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="63" cy="98" r="4.5" fill="#E8572A" filter="url(#rb-glow)" />

      {/* Antenne */}
      <path d="M80 26v-12" stroke="#cfc6ba" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="80" cy="11" r="5" fill="#E8572A" filter="url(#rb-glow)" />
    </svg>
  );
}
