"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Users,
  Bot,
  PhoneCall,
  AudioLines,
  Ticket,
  Inbox,
  Mail,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  Lock,
  Hash,
  Calculator,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { logout } from "@/app/actions/auth";
import { lockAdmin } from "@/app/actions/admin-auth";

const NAV = [
  { href: "/admin", label: "Revenus & métriques", icon: LayoutDashboard, exact: true },
  { href: "/admin/couts", label: "Coûts & rentabilité", icon: Calculator },
  { href: "/admin/organizations", label: "Organisations", icon: Building2 },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/agents", label: "Agents", icon: Bot },
  { href: "/admin/calls", label: "Appels", icon: PhoneCall },
  { href: "/admin/numbers", label: "Numéros à vérifier", icon: Hash },
  { href: "/admin/voices", label: "Voix", icon: AudioLines },
  { href: "/admin/promos", label: "Codes promo", icon: Ticket },
  { href: "/admin/demandes", label: "Demandes Agence", icon: Inbox },
  { href: "/admin/email", label: "E-mails", icon: Mail },
];

function SidebarContent({
  userName,
  userEmail,
  onNavigate,
}: {
  userName: string;
  userEmail: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col border-r border-border bg-card text-foreground">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand text-white">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">Administration</p>
          <p className="text-[0.7rem] text-foreground/50">Centre de contrôle</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className="size-[1.15rem] shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/overview"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="size-[1.15rem]" strokeWidth={1.75} />
          Retour à mon espace
        </Link>
        <form action={lockAdmin} className="mb-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <Lock className="size-[1.15rem]" strokeWidth={1.75} />
            Verrouiller l&apos;admin
          </button>
        </form>
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold">
            {initials(userName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{userName}</span>
            <span className="block truncate text-xs text-foreground/50">{userEmail}</span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Se déconnecter"
              className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarContent userName={userName} userEmail={userEmail} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fermer"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 inline-flex size-8 items-center justify-center rounded-md text-foreground/70 hover:bg-foreground/10"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              userName={userName}
              userEmail={userEmail}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-semibold">Administration</span>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
