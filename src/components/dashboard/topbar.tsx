"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { NotificationsBell } from "./notifications-bell";
import { CommandPalette } from "./command-palette";

export interface ServiceStatus {
  tone: "ok" | "warn" | "danger";
  /** Libellé court, compréhensible par un client. */
  label: string;
  href: string;
  /** Détail en infobulle (détails techniques réservés à l'équipe Callpme). */
  detail?: string;
}

/** État du compte : abonnement et disponibilité des appels. */
function ServiceChip({ status }: { status: ServiceStatus }) {
  const ok = status.tone === "ok";
  return (
    <Link
      href={status.href}
      title={status.detail ?? status.label}
      className={cn(
        "mx-auto hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors md:inline-flex",
        ok && "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400",
        status.tone === "warn" && "border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400",
        status.tone === "danger" && "border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-400",
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {ok && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            ok ? "bg-emerald-400" : status.tone === "warn" ? "bg-amber-400" : "bg-rose-500",
          )}
        />
      </span>
      {status.label}
    </Link>
  );
}

/** Barre supérieure : logo · état du service · recherche, notifications, création. */
export function Topbar({
  onMenuClick,
  status,
  menuLabel = "Ouvrir le menu",
  menuExpanded,
}: {
  onMenuClick: () => void;
  status?: ServiceStatus;
  menuLabel?: string;
  menuExpanded?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
        aria-label={menuLabel}
        aria-expanded={menuExpanded}
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
