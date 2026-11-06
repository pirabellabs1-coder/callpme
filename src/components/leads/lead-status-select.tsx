"use client";

import { useState } from "react";

const LABELS: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  won: "Gagné",
  lost: "Perdu",
};

export function LeadStatusSelect({ id, status, name }: { id: string; status: string; name: string }) {
  const [value, setValue] = useState(status);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setState("saving");
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) setState("idle");
    else {
      setValue(prev);
      setState("error");
    }
  }

  return (
    <div>
      <label htmlFor={`lead-${id}`} className="sr-only">
        Suivi de {name}
      </label>
      <select
        id={`lead-${id}`}
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={state === "saving"}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
      >
        {Object.entries(LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {state === "error" && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          Non enregistré.
        </p>
      )}
    </div>
  );
}
