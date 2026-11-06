"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Carte « appel en cours » du hero : un échange réaliste s'affiche ligne par
 * ligne pendant que l'onde vocale réagit. Purement illustratif (aucun appel
 * réel). Respecte prefers-reduced-motion : tout s'affiche d'un coup, sans
 * animation de l'onde.
 */
const TURNS: { who: "caller" | "agent"; text: string }[] = [
  { who: "agent", text: "Cabinet Diallo, bonjour. Je suis l'assistante du docteur, que puis-je faire pour vous ?" },
  { who: "caller", text: "Bonjour, je voudrais un rendez-vous cette semaine, si possible jeudi." },
  { who: "agent", text: "Jeudi, j'ai 10 h 30 ou 16 h. Lequel vous convient ?" },
  { who: "caller", text: "16 h, c'est parfait." },
  { who: "agent", text: "C'est noté pour jeudi à 16 h. Vous recevez la confirmation par SMS." },
];

const BARS = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.8, 0.4, 0.7, 0.95, 0.5, 0.65, 0.3, 0.85, 0.6, 0.45, 0.75];

export function LiveCallCard() {
  const [shown, setShown] = useState(1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduced(true);
      setShown(TURNS.length);
      return;
    }
    const id = window.setInterval(() => {
      setShown((n) => (n >= TURNS.length ? 1 : n + 1));
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  const speaking = TURNS[Math.min(shown, TURNS.length) - 1]?.who ?? "agent";

  return (
    <div className="bezel w-full max-w-[460px]">
      <div className="bezel-core overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <span className="text-sm font-medium text-foreground">Appel en cours</span>
          </div>
          <span className="mono text-xs text-muted-foreground">+225 07 •• •• 42</span>
        </div>

        <div
          aria-hidden
          className="relative flex h-20 items-center justify-center gap-[3px] px-6"
        >
          <div className="glow-brand pointer-events-none absolute inset-x-10 inset-y-0" />
          {BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "relative w-[3px] origin-center rounded-full",
                speaking === "agent" ? "bg-brand" : "bg-foreground/60",
                !reduced && "animate-wave",
              )}
              style={{ height: `${h * 44}px`, animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>

        <ol
          className="flex h-[260px] flex-col justify-end gap-2.5 overflow-hidden px-5 pb-5 [mask-image:linear-gradient(to_bottom,transparent,black_18%)]"
          aria-label="Exemple de conversation entre un patient et l'agent vocal"
        >
          {TURNS.slice(0, shown).map((t, i) => (
            <li
              key={i}
              className={cn(
                "max-w-[85%] animate-fade-up rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                t.who === "agent"
                  ? "self-start bg-foreground/[0.06] text-foreground"
                  : "self-end bg-brand/15 text-foreground",
              )}
            >
              <span className="sr-only">{t.who === "agent" ? "Agent : " : "Appelant : "}</span>
              {t.text}
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>Rendez-vous ajouté à l'agenda</span>
          <span className="mono">720 ms</span>
        </div>
      </div>
    </div>
  );
}
