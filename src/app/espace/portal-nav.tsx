"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/espace", label: "Tableau de bord" },
  { href: "/espace/appels", label: "Appels" },
  { href: "/espace/rendez-vous", label: "Rendez-vous" },
  { href: "/espace/prospects", label: "Prospects" },
  { href: "/espace/rapport", label: "Rapport du mois" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espace client" className="flex flex-wrap gap-1">
      {ITEMS.map((i) => {
        const active = i.href === "/espace" ? pathname === "/espace" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
              active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
