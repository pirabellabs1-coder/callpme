"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRADES } from "./trades-data";

/**
 * Vitrine par métier : un onglet par secteur, avec photo, ce que fait
 * l'agent et un extrait de conversation. Onglets accessibles (flèches
 * gauche/droite, rôle tablist).
 */


export function TradesShowcase() {
  const [active, setActive] = useState(0);
  const t = TRADES[active];

  // Lien direct vers un secteur : /metiers#coiffure ouvre l'onglet correspondant.
  useEffect(() => {
    const open = () => {
      const i = TRADES.findIndex((tr) => `#${tr.key}` === window.location.hash);
      if (i >= 0) setActive(i);
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowRight" ? 1 : TRADES.length - 1)) % TRADES.length;
    setActive(next);
    document.getElementById(`metier-${TRADES[next].key}`)?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Métiers"
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
      >
        {TRADES.map((tr, i) => (
          <button
            key={tr.key}
            id={`metier-${tr.key}`}
            role="tab"
            aria-selected={i === active}
            aria-controls="panneau-metier"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-300 ease-spring",
              i === active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {tr.label}
          </button>
        ))}
      </div>

      <div
        id="panneau-metier"
        role="tabpanel"
        aria-labelledby={`metier-${t.key}`}
        className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div key={`photo-${t.key}`} className="bezel animate-fade-in">
          <div className="bezel-core relative aspect-[4/5] overflow-hidden lg:aspect-auto lg:h-full lg:min-h-[480px]">
            <Image
              src={t.photo}
              alt={t.alt}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-cover"
              priority={active === 0}
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-4xl font-semibold tracking-tight text-white tabular">{t.stat.value}</p>
              <p className="mt-1 max-w-xs text-sm text-white/75">{t.stat.label}</p>
              <p className="mt-4 text-[11px] text-white/50">
                Photo :{" "}
                <a href={`${t.credit.url}?utm_source=callpme&utm_medium=referral`} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                  {t.credit.name}
                </a>{" "}
                sur Unsplash
              </p>
            </div>
          </div>
        </div>

        <div key={`text-${t.key}`} className="bezel animate-fade-up">
          <div className="bezel-core flex h-full flex-col p-7 sm:p-9">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{t.title}</h3>
            <ul className="mt-6 space-y-3">
              {t.tasks.map((task) => (
                <li key={task} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} aria-hidden />
                  {task}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-border bg-background/60 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                Extrait d'appel
              </p>
              <ol className="flex flex-col gap-2" aria-label={`Exemple de conversation, ${t.label}`}>
                {t.demo.map((d, i) => (
                  <li
                    key={i}
                    style={{ animationDelay: `${150 + i * 350}ms` }}
                    className={cn(
                      "max-w-[88%] animate-fade-up rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed text-foreground",
                      d.who === "agent" ? "self-start bg-foreground/[0.06]" : "self-end bg-brand/15",
                    )}
                  >
                    <span className="sr-only">{d.who === "agent" ? "Agent : " : "Appelant : "}</span>
                    {d.text}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
