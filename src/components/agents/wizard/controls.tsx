"use client";

import { forwardRef } from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** id DOM d'un champ du wizard (cible du focus lors d'une erreur). */
export const fieldId = (key: string) => `field-${key}`;
/** id DOM du message d'erreur associé (aria-describedby). */
export const errorId = (key: string) => `error-${key}`;

/** Props ARIA à poser sur un contrôle selon son état d'erreur. */
export function invalidProps(key: string, error?: string) {
  return error
    ? { "aria-invalid": true as const, "aria-describedby": errorId(key) }
    : {};
}

export function FieldError({
  name,
  message,
}: {
  name: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={errorId(name)}
      className="flex items-start gap-1.5 text-xs font-medium text-destructive"
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** En-tête d'étape. Le titre reçoit le focus à chaque changement d'étape. */
export const StepShell = forwardRef<
  HTMLHeadingElement,
  {
    step: number;
    total: number;
    title: string;
    description: string;
    children: React.ReactNode;
  }
>(function StepShell({ step, total, title, description, children }, ref) {
  return (
    <section aria-labelledby="wizard-step-title" className="space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Étape {step} sur {total}
        </p>
        <h2
          ref={ref}
          id="wizard-step-title"
          tabIndex={-1}
          className="mt-1 text-lg font-semibold tracking-tight focus:outline-none"
        >
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
});

/** Carte de choix (un seul choix parmi plusieurs). */
export function ChoiceCard({
  selected,
  onClick,
  icon: Icon,
  title,
  note,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  title: string;
  note: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-brand/70 bg-brand/[0.07] ring-1 ring-inset ring-brand/30"
          : "border-border bg-card hover:border-foreground/20 hover:bg-foreground/[0.02]",
      )}
    >
      {Icon && (
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
            selected
              ? "bg-brand text-brand-foreground"
              : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {note}
        </span>
      </span>
    </button>
  );
}
