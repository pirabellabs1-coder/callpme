"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CALL_STATUSES, CALL_STATUS_LABELS } from "./call-filters";

const FIELD =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-xs transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15";

export function CallsFilterBar({
  agents,
}: {
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const search = params.get("search") ?? "";
  const [q, setQ] = useState(search);
  useEffect(() => setQ(search), [search]);

  function apply(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    // Tout changement de filtre ramène à la première page.
    sp.delete("page");
    startTransition(() => {
      router.push(sp.toString() ? `${pathname}?${sp}` : pathname);
    });
  }

  // La saisie clavier d'une date émet des valeurs intermédiaires (année
  // « 0002 »…) : on n'applique qu'une date plausible ou un effacement.
  function applyDate(key: "from" | "to", value: string) {
    if (value && Number(value.slice(0, 4)) < 2000) return;
    apply({ [key]: value || undefined });
  }

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const hasFilters = Boolean(
    params.get("agentId") ||
      params.get("status") ||
      params.get("direction") ||
      from ||
      to ||
      search,
  );

  return (
    <div
      role="search"
      aria-label="Filtrer les appels"
      aria-busy={pending}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply({ search: q.trim() || undefined });
          }}
          className="relative flex-1"
        >
          {pending ? (
            <Loader2
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none"
            />
          ) : (
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          )}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            aria-label="Rechercher un appel (numéro, agent, issue ou résumé) puis Entrée"
            placeholder="Numéro, agent, issue, résumé… puis Entrée"
            className={cn(FIELD, "w-full pl-9 placeholder:text-muted-foreground/60")}
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={params.get("agentId") ?? ""}
            onChange={(e) => apply({ agentId: e.target.value || undefined })}
            className="h-10 w-44"
            aria-label="Filtrer par agent"
          >
            <option value="">Tous les agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            value={params.get("direction") ?? ""}
            onChange={(e) => apply({ direction: e.target.value || undefined })}
            className="h-10 w-40"
            aria-label="Filtrer par direction"
          >
            <option value="">Toutes directions</option>
            <option value="inbound">Entrant</option>
            <option value="outbound">Sortant</option>
          </Select>
          <Select
            value={params.get("status") ?? ""}
            onChange={(e) => apply({ status: e.target.value || undefined })}
            className="h-10 w-36"
            aria-label="Filtrer par statut"
          >
            <option value="">Tous statuts</option>
            {CALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CALL_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Période</legend>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Du
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => applyDate("from", e.target.value)}
              className={cn(FIELD, "w-[9.5rem] tabular")}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            au
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => applyDate("to", e.target.value)}
              className={cn(FIELD, "w-[9.5rem] tabular")}
            />
          </label>
        </fieldset>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname));
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
          >
            <X className="size-4" aria-hidden="true" />
            Réinitialiser les filtres
          </button>
        )}
      </div>
    </div>
  );
}
