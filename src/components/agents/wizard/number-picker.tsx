"use client";

import Link from "next/link";
import { Check, Phone, PhoneOff, Plus } from "lucide-react";
import type { PhoneNumberRecord } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

const optionClass = (selected: boolean) =>
  cn(
    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
    selected
      ? "border-brand/70 bg-brand/[0.07] ring-1 ring-inset ring-brand/30"
      : "border-border bg-card hover:border-foreground/20 hover:bg-foreground/[0.02]",
  );

export function NumberPicker({
  value,
  ownNumber,
  usedNumbers,
  numbers,
  onChange,
}: {
  value: string | null;
  ownNumber: string | null;
  usedNumbers: string[];
  numbers: PhoneNumberRecord[];
  onChange: (n: string | null) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Numéro de téléphone</legend>
      <div className="flex items-center justify-between gap-3">
        <span aria-hidden className="text-sm font-medium text-foreground">
          Numéro de téléphone
        </span>
        <Link
          href="/numbers"
          className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
        >
          <Plus className="size-3" aria-hidden />
          Ajouter un numéro
        </Link>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={optionClass(value === null)}
        >
          <PhoneOff className="size-4 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm font-medium text-foreground">
            Aucun numéro pour l&apos;instant
          </span>
          {value === null && (
            <Check className="size-4 text-brand" aria-hidden />
          )}
        </button>
        {numbers.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            Aucun numéro disponible. Ajoutez-en un depuis la page Numéros
            (Twilio, Zadarma…) puis revenez ici.
          </p>
        )}
        {numbers.map((num) => {
          const taken =
            usedNumbers.includes(num.number) && num.number !== ownNumber;
          const selected = value === num.number;
          return (
            <button
              key={num.number}
              type="button"
              disabled={taken}
              aria-pressed={selected}
              onClick={() => onChange(num.number)}
              className={cn(
                optionClass(selected),
                taken &&
                  "cursor-not-allowed opacity-50 hover:border-border hover:bg-card",
              )}
            >
              <Phone
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="mono block text-sm font-medium text-foreground">
                  {num.number}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {num.label} · {num.provider}
                </span>
              </span>
              {taken ? (
                <span className="text-xs text-muted-foreground">
                  Utilisé par un autre agent
                </span>
              ) : selected ? (
                <Check className="size-4 text-brand" aria-hidden />
              ) : (
                <span className="mono text-xs text-muted-foreground">
                  {num.monthlyPrice} €/mois
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
