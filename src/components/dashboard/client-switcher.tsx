"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronsUpDown, Check, Loader2, Settings2 } from "lucide-react";
import { setActiveClient } from "@/app/actions/clients";
import { cn } from "@/lib/utils";

export function ClientSwitcher({
  clients,
  activeClientId,
  onNavigate,
}: {
  clients: { id: string; name: string }[];
  activeClientId: string | null;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const active = clients.find((c) => c.id === activeClientId) ?? null;

  function choose(id: string | null) {
    setOpen(false);
    startTransition(async () => {
      await setActiveClient(id);
      router.refresh();
    });
  }

  if (clients.length === 0) return null;

  return (
    <div className="relative px-3 pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/50"
      >
        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {active ? active.name : "Tous les clients"}
        </span>
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-3 right-3 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span className="flex-1 truncate">Tous les clients</span>
              {!active && <Check className="size-3.5 text-brand" />}
            </button>
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              >
                <span className="flex-1 truncate">{c.name}</span>
                {active?.id === c.id && <Check className="size-3.5 text-brand" />}
              </button>
            ))}
            <Link
              href="/clients"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="mt-1 flex items-center gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Settings2 className="size-3.5" />
              Gérer les clients
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
