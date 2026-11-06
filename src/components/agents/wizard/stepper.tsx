"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPS } from "./state";

/**
 * Indicateur d'étapes cliquable. Chaque étape est un bouton ; l'étape
 * courante porte aria-current="step". La navigation vers l'avant est
 * validée par le parent (onStepClick).
 */
export function Stepper({
  step,
  maxReached,
  onStepClick,
}: {
  step: number;
  /** Étape la plus avancée atteinte (les suivantes restent accessibles via validation). */
  maxReached: number;
  onStepClick: (n: number) => void;
}) {
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <nav aria-label="Étapes de configuration" className="space-y-3">
      <ol className="grid grid-cols-5 gap-1 sm:gap-2">
        {STEPS.map((st) => {
          const active = st.n === step;
          const done = st.n < step || (st.n <= maxReached && st.n !== step);
          return (
            <li key={st.n} className="min-w-0">
              <button
                type="button"
                onClick={() => onStepClick(st.n)}
                aria-current={active ? "step" : undefined}
                aria-label={`Étape ${st.n} : ${st.label}${done && !active ? " (complétée)" : ""}`}
                className={cn(
                  "group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center transition-colors sm:flex-row sm:gap-2.5 sm:px-2.5 sm:text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
                  active
                    ? "bg-foreground/[0.05]"
                    : "hover:bg-foreground/[0.03]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular transition-colors",
                    active
                      ? "bg-brand text-brand-foreground ring-4 ring-brand/15"
                      : done
                        ? "bg-brand/15 text-brand-700"
                        : "bg-secondary text-muted-foreground ring-1 ring-inset ring-border",
                  )}
                >
                  {done && !active ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    st.n
                  )}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "w-full truncate text-[0.7rem] font-medium sm:text-sm",
                    active
                      ? "text-foreground"
                      : done
                        ? "text-foreground/80"
                        : "text-muted-foreground",
                  )}
                >
                  {st.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div
        className="h-1 overflow-hidden rounded-full bg-secondary"
        aria-hidden
      >
        <div
          className="h-full origin-left rounded-full bg-brand transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${Math.max(progress, 4) / 100})` }}
        />
      </div>
    </nav>
  );
}
