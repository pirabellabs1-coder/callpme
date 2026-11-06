"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, SlidersHorizontal, PlayCircle, FlaskConical, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

/** Onglets de l'espace de travail d'un agent. */
export function AgentTabs({ agentId }: { agentId: string }) {
  const pathname = usePathname();
  const base = `/agents/${agentId}`;
  const tabs = [
    { href: base, label: "Aperçu", icon: LayoutGrid, active: pathname === base },
    { href: `${base}/edit`, label: "Configuration", icon: SlidersHorizontal, active: pathname.startsWith(`${base}/edit`) },
    { href: `${base}/flow`, label: "Parcours", icon: Workflow, active: pathname.startsWith(`${base}/flow`) },
    { href: `${base}/test`, label: "Tester", icon: PlayCircle, active: pathname === `${base}/test` },
    { href: `${base}/tests`, label: "Scénarios de test", icon: FlaskConical, active: pathname.startsWith(`${base}/tests`) },
  ];
  return (
    <nav aria-label="Sections de l'agent" className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors",
            t.active
              ? "border-brand text-foreground"
              : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
          )}
        >
          <t.icon className={cn("size-4", t.active ? "text-brand" : "")} strokeWidth={1.75} aria-hidden />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
