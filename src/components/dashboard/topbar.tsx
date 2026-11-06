"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { NotificationsBell } from "./notifications-bell";
import { CommandPalette } from "./command-palette";

export interface ServiceStatus {
  /** Prêt pour de vrais appels (moteur vocal + opérateur). */
  ready: boolean;
  /** Ce qui manque, en clair. */
  missing: string[];
}

/** Indicateur d'état du service vocal (vert = prêt, ambre = à configurer). */
function ServiceChip({ status }: { status: ServiceStatus }) {
  const label = status.ready ? "Appels réels actifs" : "Mode test : appels réels à configurer";
  return (
    <Link
      href="/numbers"
      title={status.ready ? label : `Manque : ${status.missing.join(", ")}`}
      className={cn(
        "mx-auto hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors md:inline-flex",
        status.ready
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
          : "border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {status.ready && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />}
        <span className={cn("relative inline-flex size-2 rounded-full", status.ready ? "bg-emerald-400" : "bg-amber-400")} />
      </span>
      {label}
    </Link>
  );
}

/** Barre supérieure : logo · état du service · recherche, notifications, création. */
export function Topbar({ onMenuClick, status }: { onMenuClick: () => void; status?: ServiceStatus }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      <Link href="/overview" className="shrink-0 rounded-md" aria-label="Accueil">
        <Logo markSize={24} />
      </Link>

      {status && <ServiceChip status={status} />}

      <div className="ml-auto flex items-center gap-1.5">
        <CommandPalette />
        <NotificationsBell />
        <Link href="/agents/new" className={cn(buttonVariants({ variant: "brand", size: "sm" }), "gap-1.5")}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Nouvel agent</span>
        </Link>
      </div>
    </header>
  );
}
