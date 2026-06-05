"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, ChevronDown, LogOut } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { getPlan } from "@/lib/billing/plans";
import { logout } from "@/app/actions/auth";
import {
  PRIMARY_NAV,
  AGENCY_NAV,
  SYSTEM_NAV,
  type NavItem,
} from "./nav-items";
import { ClientSwitcher } from "./client-switcher";

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-[1.1rem] shrink-0 transition-colors",
          active ? "text-brand" : "text-muted-foreground/80 group-hover:text-foreground",
        )}
        strokeWidth={1.75}
      />
      {item.label}
    </Link>
  );
}

function NavSection({
  label,
  items,
  isActive,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  isActive: (i: NavItem) => boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        {label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  orgName,
  orgPlan,
  userName,
  userEmail,
  clients,
  activeClientId,
  onNavigate,
}: {
  orgName: string;
  orgPlan: string;
  userName: string;
  userEmail: string;
  clients: { id: string; name: string; brandColor?: string | null }[];
  activeClientId: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.match ? pathname.startsWith(item.match) : pathname === item.href;
  const plan = getPlan(orgPlan);
  const isAgency = plan.id === "agency";
  // Multi-clients réservé à l'offre Agence.
  const agencyNav = isAgency
    ? AGENCY_NAV
    : AGENCY_NAV.filter((i) => i.href !== "/clients");

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Organisation */}
      <div className="px-3 pt-4">
        <Link
          href="/billing"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left shadow-xs transition-colors hover:bg-accent/50"
        >
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-foreground text-[0.7rem] font-semibold text-background">
            {initials(orgName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {orgName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Plan {plan.name}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>

      {/* Client actif (agence uniquement) */}
      {isAgency && (
        <ClientSwitcher
          clients={clients}
          activeClientId={activeClientId}
          onNavigate={onNavigate}
        />
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        <NavSection label="Plateforme" items={PRIMARY_NAV} isActive={isActive} onNavigate={onNavigate} />
        <NavSection label="Agence" items={agencyNav} isActive={isActive} onNavigate={onNavigate} />
        <NavSection label="Système" items={SYSTEM_NAV} isActive={isActive} onNavigate={onNavigate} />
      </nav>

      {/* Profil */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand/20">
            {initials(userName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {userName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {userEmail}
            </span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Se déconnecter"
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
