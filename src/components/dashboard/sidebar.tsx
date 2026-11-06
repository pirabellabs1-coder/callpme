"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { getPlan } from "@/lib/billing/plans";
import { logout } from "@/app/actions/auth";
import { NAV_GROUPS, type NavItem } from "./nav-items";
import { ClientSwitcher } from "./client-switcher";

/** Compteurs « à traiter » affichés à côté des liens (clé = href). */
export type NavBadges = Record<string, number>;

export interface UsageMeter {
  used: number;
  total: number;
}

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[0.4rem] text-[0.84rem] font-medium transition-[background-color,color] duration-200",
        active
          ? "bg-foreground/[0.06] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {active && (
        <span aria-hidden className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
      )}
      <Icon
        className={cn(
          "size-[1.05rem] shrink-0 transition-colors",
          active ? "text-brand" : "text-muted-foreground/70 group-hover:text-foreground",
        )}
        strokeWidth={1.6}
        aria-hidden
      />
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? (
        <span
          className="min-w-[1.25rem] rounded-full bg-brand/15 px-1.5 text-center text-[0.7rem] font-semibold tabular-nums leading-5 text-brand"
          aria-label={`${badge} à traiter`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  orgName,
  orgPlan,
  userName,
  userEmail,
  clients,
  activeClientId,
  badges = {},
  usage,
  onNavigate,
}: {
  orgName: string;
  orgPlan: string;
  userName: string;
  userEmail: string;
  clients: { id: string; name: string; brandColor?: string | null }[];
  activeClientId: string | null;
  badges?: NavBadges;
  usage?: UsageMeter | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.match ? pathname.startsWith(item.match) : pathname === item.href);
  const plan = getPlan(orgPlan);
  const isAgency = plan.id === "agency";
  const pct = usage && usage.total > 0 ? Math.min(100, Math.round((usage.used / usage.total) * 100)) : 0;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Organisation */}
      <div className="px-3 pt-4">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-[0.6rem] bg-foreground text-[0.7rem] font-semibold text-background">
            {initials(orgName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">{orgName}</span>
            <span className="block truncate text-xs text-muted-foreground">Offre {plan.name}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </div>

      {isAgency && <ClientSwitcher clients={clients} activeClientId={activeClientId} onNavigate={onNavigate} />}

      {/* Navigation par usage */}
      <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV_GROUPS.filter((g) => !g.agencyOnly || isAgency).map((group) => (
          <div key={group.id} className="space-y-0.5">
            <p className="px-2.5 pb-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item)}
                badge={badges[item.href]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Consommation du mois */}
      {usage && usage.total > 0 && (
        <Link
          href="/billing"
          onClick={onNavigate}
          className="mx-3 mb-3 block rounded-xl border border-border bg-foreground/[0.02] p-3 transition-colors hover:bg-foreground/[0.04]"
        >
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-foreground">Minutes du mois</span>
            <span className="tabular-nums text-muted-foreground">
              {usage.used.toLocaleString("fr-FR")} / {usage.total.toLocaleString("fr-FR")}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]"
            role="progressbar"
            aria-label="Minutes consommées ce mois-ci"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-brand")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Link>
      )}

      {/* Profil */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
          <span className="inline-flex size-8 items-center justify-center rounded-[0.6rem] bg-brand/10 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/20">
            {initials(userName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{userName}</span>
            <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>
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
