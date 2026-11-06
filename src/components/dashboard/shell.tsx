"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar, type NavBadges, type UsageMeter } from "./sidebar";
import { Topbar, type ServiceStatus } from "./topbar";
import { setActiveClient } from "@/app/actions/clients";

interface ClientLite {
  id: string;
  name: string;
  brandColor?: string | null;
}

export function DashboardShell({
  orgName,
  orgPlan,
  userName,
  userEmail,
  clients,
  activeClientId,
  activeClientName,
  activeClientColor,
  badges,
  usage,
  status,
  children,
}: {
  orgName: string;
  orgPlan: string;
  userName: string;
  userEmail: string;
  clients: ClientLite[];
  activeClientId: string | null;
  activeClientName?: string | null;
  activeClientColor?: string | null;
  badges?: NavBadges;
  usage?: UsageMeter | null;
  status?: ServiceStatus;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function exitClient() {
    startTransition(async () => {
      await setActiveClient(null);
      router.refresh();
    });
  }

  const sidebarProps = {
    orgName,
    orgPlan,
    userName,
    userEmail,
    clients,
    activeClientId,
    badges,
    usage,
  };

  // Couleur du client actif appliquée à TOUT le tableau de bord (anti-mélange).
  const themeStyle = activeClientColor
    ? ({ "--brand": activeClientColor, "--brand-soft": activeClientColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-dvh bg-background bg-grain" style={themeStyle}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Aller au contenu
      </a>
      <Topbar onMenuClick={() => setOpen(true)} status={status} />

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
          <Sidebar {...sidebarProps} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Fermer le menu"
              className="absolute inset-0 bg-foreground/25 backdrop-blur-sm animate-fade-in"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-border bg-card shadow-xl animate-fade-up">
              <button
                onClick={() => setOpen(false)}
                className="absolute right-3 top-4 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
              <Sidebar {...sidebarProps} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main id="contenu" tabIndex={-1} className="min-w-0 flex-1 px-4 py-7 outline-none sm:px-6 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-[1240px]">
            {activeClientName && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--brand)/0.35)] bg-[hsl(var(--brand)/0.08)] px-4 py-2.5">
                <p className="inline-flex items-center gap-2 text-sm">
                  <span className="inline-block size-2.5 rounded-full bg-[hsl(var(--brand))]" />
                  <span className="text-muted-foreground">Espace client :</span>
                  <span className="font-semibold text-foreground">{activeClientName}</span>
                </p>
                <button
                  type="button"
                  onClick={exitClient}
                  className="text-xs font-medium text-[hsl(var(--brand))] hover:underline"
                >
                  Quitter l'espace
                </button>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
