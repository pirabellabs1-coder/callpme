"use client";

import Link from "next/link";
import { Menu, Plus, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { NotificationsBell } from "./notifications-bell";
import { CommandPalette } from "./command-palette";

/** Barre supérieure pleine largeur (logo · promo · actions), style console. */
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="size-5" />
      </button>

      <Link href="/overview" className="shrink-0 rounded-md" aria-label="Accueil">
        <Logo markSize={26} />
      </Link>

      {/* Bandeau promo central */}
      <Link
        href="/billing"
        className="mx-auto hidden items-center gap-2 rounded-full border border-brand/20 bg-brand-50/60 px-4 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 md:inline-flex"
      >
        <Gift className="size-4" />
        Parrainez Callpme et gagnez 3 mois offerts
      </Link>

      <div className="ml-auto flex items-center gap-1.5">
        <CommandPalette />
        <NotificationsBell />
        <Link
          href="/agents/new"
          className={cn(buttonVariants({ variant: "brand", size: "sm" }), "gap-1.5")}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nouvel agent</span>
        </Link>
      </div>
    </header>
  );
}
