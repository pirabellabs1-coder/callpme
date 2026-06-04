"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function DashboardShell({
  orgName,
  orgPlan,
  userName,
  userEmail,
  isAdmin,
  clients,
  activeClientId,
  children,
}: {
  orgName: string;
  orgPlan: string;
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  clients: { id: string; name: string }[];
  activeClientId: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebarProps = {
    orgName,
    orgPlan,
    userName,
    userEmail,
    isAdmin,
    clients,
    activeClientId,
  };

  return (
    <div className="min-h-screen bg-muted/30 bg-grain">
      {/* Barre supérieure pleine largeur */}
      <Topbar onMenuClick={() => setOpen(true)} />

      <div className="flex">
        {/* Sidebar — bureau */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
          <Sidebar {...sidebarProps} />
        </aside>

        {/* Sidebar — tiroir mobile */}
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

        <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
