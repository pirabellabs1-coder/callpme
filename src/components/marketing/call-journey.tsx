"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Check, MessageSquareText, PhoneIncoming, UserRoundPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Scène « un appel, de la sonnerie au résumé ». Quatre étapes qui défilent
 * seules (pause au survol / au focus), cliquables au clavier comme des onglets.
 * Avec prefers-reduced-motion, rien ne défile tout seul.
 */
const STEPS = [
  { key: "ring", label: "Ça sonne", hint: "2 h 14 du matin, le garage est fermé." },
  { key: "pickup", label: "Votre agent décroche", hint: "Dès la première sonnerie, avec votre message d'accueil." },
  { key: "act", label: "Il agit pour vous", hint: "Rendez-vous, fiche client et SMS, pendant l'appel." },
  { key: "summary", label: "Vous lisez le résumé", hint: "Le matin, vous trouvez le résumé de l'appel." },
] as const;

const DURATION = 4200;

export function CallJourney() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), DURATION);
    return () => window.clearTimeout(id);
  }, [step, paused, reduced]);

  return (
    <div
      className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div role="tablist" aria-label="Étapes d'un appel" className="flex flex-col gap-2">
        {STEPS.map((s, i) => {
          const active = i === step;
          return (
            <button
              key={s.key}
              role="tab"
              id={`etape-${s.key}`}
              aria-selected={active}
              aria-controls="scene-appel"
              onClick={() => setStep(i)}
              className={cn(
                "relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition-colors duration-500 ease-spring",
                active ? "border-foreground/15 bg-foreground/[0.05]" : "border-transparent hover:bg-foreground/[0.03]",
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn("mono text-xs", active ? "text-brand" : "text-muted-foreground")}>0{i + 1}</span>
                <span className={cn("text-base font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
              </span>
              <span className={cn("mt-1 block pl-8 text-sm text-muted-foreground", !active && "sr-only")}>{s.hint}</span>
              {active && !reduced && (
                <span
                  key={`${step}-${paused}`}
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-px origin-left bg-brand",
                    paused ? "scale-x-0" : "animate-progress",
                  )}
                  style={{ ["--progress-duration" as string]: `${DURATION}ms` }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="bezel">
        <div
          id="scene-appel"
          role="tabpanel"
          aria-labelledby={`etape-${STEPS[step].key}`}
          className="bezel-core relative flex min-h-[380px] items-center justify-center overflow-hidden p-6 sm:p-10"
        >
          <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
          <div key={step} className="relative w-full max-w-sm animate-scale-in">
            {step === 0 && <Ring />}
            {step === 1 && <Pickup />}
            {step === 2 && <Act />}
            {step === 3 && <Summary />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex size-28 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/20 motion-reduce:hidden" />
        <span className="absolute inset-3 rounded-full bg-brand/15" />
        <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-brand">
          <PhoneIncoming className="size-7" strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Appel entrant · Garage Mensah, Abidjan</p>
      <p className="mono mt-2 text-2xl text-foreground">+225 07 •• •• 18</p>
      <p className="mt-6 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">02:14 · hors horaires d'ouverture</p>
    </div>
  );
}

function Pickup() {
  const bars = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.95, 0.65, 0.45, 0.8, 0.55, 0.9];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-foreground">
          <span className="size-2 rounded-full bg-success" aria-hidden /> Décroché
        </span>
        <span className="mono text-muted-foreground">0,4 s</span>
      </div>
      <div aria-hidden className="flex h-16 items-center justify-center gap-1">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-brand animate-wave"
            style={{ height: `${h * 56}px`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <p className="rounded-2xl bg-foreground/[0.06] px-4 py-3 text-sm leading-relaxed text-foreground">
        « Garage Mensah, bonsoir. Le garage est fermé, mais je peux vous proposer un rendez-vous. Pour quel véhicule ? »
      </p>
      <p className="ml-auto w-fit rounded-2xl bg-brand/15 px-4 py-3 text-sm text-foreground">
        « Une Corolla, pour une révision. »
      </p>
    </div>
  );
}

function Act() {
  const rows = [
    { icon: CalendarCheck, title: "Rendez-vous réservé", detail: "Révision · jeudi 9 h 00" },
    { icon: UserRoundPlus, title: "Fiche client créée", detail: "Kouadio A. · Toyota Corolla" },
    { icon: MessageSquareText, title: "SMS de confirmation", detail: "Envoyé au +225 07 •• •• 18" },
  ];
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li
          key={r.title}
          style={{ animationDelay: `${i * 450}ms` }}
          className="flex animate-fade-up items-center gap-4 rounded-2xl border border-border bg-background/60 px-4 py-3.5"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-brand">
            <r.icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{r.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
          </span>
          <Check className="size-4 text-success" strokeWidth={2} aria-label="fait" />
        </li>
      ))}
    </ul>
  );
}

function Summary() {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Résumé de l'appel</span>
        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success">Résolu</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Client existant, Toyota Corolla. Demande de révision. Rendez-vous fixé jeudi à 9 h, confirmation envoyée par SMS.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
        {[
          ["Durée", "1 min 52"],
          ["Ton", "Positif"],
          ["Actions", "3"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
