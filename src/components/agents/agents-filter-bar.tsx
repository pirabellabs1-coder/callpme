"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { ROLE_ORDER, ROLE_META } from "@/lib/agents/roles";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function AgentsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";
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

  const hasFilters = Boolean(role || status || search);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            placeholder="Rechercher un agent par nom…"
            className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
          />
        </form>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onChange={(e) => apply({ status: e.target.value || undefined })}
            className="h-10 w-40"
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            <option value="active">En ligne</option>
            <option value="paused">En pause</option>
            <option value="draft">Brouillon</option>
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

      {/* Pastilles de rôle */}
      <div className="flex flex-wrap items-center gap-2">
        <RoleChip active={!role} onClick={() => apply({ role: undefined })}>
          Tous les rôles
        </RoleChip>
        {ROLE_ORDER.map((r) => (
          <RoleChip
            key={r}
            active={role === r}
            onClick={() => apply({ role: role === r ? undefined : r })}
          >
            <span
              className={cn("size-1.5 rounded-full", ROLE_META[r].dotClass)}
            />
            {ROLE_META[r].label}
          </RoleChip>
        ))}
      </div>
    </div>
  );
}

function RoleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
