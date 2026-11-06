"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, fieldId } from "./controls";

export function GuardrailsEditor({
  guardrails,
  onChange,
  error,
}: {
  guardrails: string[];
  onChange: (g: string[]) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        Garde-fous
      </legend>
      <p className="text-xs text-muted-foreground">
        Ce que l&apos;agent ne doit jamais faire ou dire (ex. donner un prix non
        validé, un conseil médical…).
      </p>
      {guardrails.length > 0 && (
        <ul className="space-y-2">
          {guardrails.map((g, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                id={i === 0 ? fieldId("guardrails") : undefined}
                value={g}
                aria-label={`Garde-fou ${i + 1}`}
                maxLength={500}
                onChange={(e) => {
                  const next = [...guardrails];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder="Ex : ne jamais donner de conseil médical"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(guardrails.filter((_, j) => j !== i))}
                aria-label={`Supprimer le garde-fou ${i + 1}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FieldError name="guardrails" message={error} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={guardrails.length >= 30}
        onClick={() => onChange([...guardrails, ""])}
      >
        <Plus className="size-4" aria-hidden />
        Ajouter un garde-fou
      </Button>
    </fieldset>
  );
}
