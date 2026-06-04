"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";

export function CallsFilterBar({
  agents,
}: {
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get("search") ?? "";
  const [q, setQ] = useState(search);
  useEffect(() => setQ(search), [search]);

  function apply(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(sp.toString() ? `${pathname}?${sp}` : pathname);
  }

  const hasFilters = Boolean(
    params.get("agentId") ||
      params.get("status") ||
      params.get("direction") ||
      search,
  );

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ search: q.trim() || undefined });
        }}
        className="relative flex-1"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par numéro ou résumé…"
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
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
          className="h-10 w-36"
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
          <option value="completed">Résolu</option>
          <option value="transferred">Transféré</option>
          <option value="missed">Manqué</option>
          <option value="failed">Échec</option>
        </Select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
