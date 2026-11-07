"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Banknote,
  BedDouble,
  BookOpen,
  Building2,
  Calculator,
  Car,
  CarFront,
  ChefHat,
  CircleHelp,
  ClipboardCheck,
  Droplets,
  GraduationCap,
  Headset,
  HeartHandshake,
  Home,
  Hospital,
  KeyRound,
  Landmark,
  Pill,
  Rocket,
  Scale,
  Scissors,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Sparkles,
  SprayCan,
  Stamp,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AgentTemplate, TemplateCategory } from "@/lib/agents/templates";
import { ROLE_META } from "@/lib/agents/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/** Icônes métier des modèles (le résolveur partagé ne couvre que rôles/outils). */
const SECTOR_ICONS: Record<string, LucideIcon> = {
  Activity,
  Banknote,
  BedDouble,
  BookOpen,
  Building2,
  Calculator,
  Car,
  CarFront,
  ChefHat,
  ClipboardCheck,
  Droplets,
  GraduationCap,
  Headset,
  HeartHandshake,
  Home,
  Hospital,
  KeyRound,
  Landmark,
  Pill,
  Rocket,
  Scale,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Sparkles,
  SprayCan,
  Stamp,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  Zap,
};

/** Minuscules sans accents, pour une recherche tolérante. */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Filter = TemplateCategory | "all";

export function TemplatesGallery({
  templates,
  categories,
}: {
  templates: AgentTemplate[];
  categories: TemplateCategory[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Filter>("all");

  const counts = useMemo(() => {
    const m = new Map<TemplateCategory, number>();
    for (const t of templates) m.set(t.industry, (m.get(t.industry) ?? 0) + 1);
    return m;
  }, [templates]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return templates.filter((t) => {
      if (category !== "all" && t.industry !== category) return false;
      if (!q) return true;
      const haystack = normalize(
        [t.name, t.sector, t.industry, t.description, ROLE_META[t.role].label].join(" "),
      );
      return q.split(/\s+/).every((w) => haystack.includes(w));
    });
  }, [templates, query, category]);

  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Tous", count: templates.length },
    ...categories
      .filter((c) => counts.has(c))
      .map((c) => ({ value: c, label: c, count: counts.get(c) ?? 0 })),
  ];

  function reset() {
    setQuery("");
    setCategory("all");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative max-w-md">
          <label htmlFor="template-search" className="sr-only">
            Rechercher un modèle
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="template-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un métier : dentiste, garage, syndic…"
            className="pl-9 pr-9"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
              aria-label="Effacer la recherche"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <div role="group" aria-label="Filtrer par secteur" className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "border-brand/40 bg-brand-50 text-brand-700"
                    : "border-border bg-foreground/[0.02] text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {c.label}
                <span className="tabular text-[0.7rem] opacity-70">{c.count}</span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {results.length} modèle{results.length > 1 ? "s" : ""}
          {category !== "all" ? ` · ${category}` : ""}
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Aucun modèle ne correspond"
          description="Essayez un autre mot-clé ou partez du modèle « Standard d'entreprise », adaptable à tous les métiers."
          action={
            <Button variant="outline" size="sm" onClick={reset}>
              Réinitialiser les filtres
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((t) => {
            const role = ROLE_META[t.role];
            const Icon = SECTOR_ICONS[t.icon] ?? CircleHelp;
            return (
              <li key={t.id} className="flex">
                <Card className="flex w-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
                        role.iconWrapClass,
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <Badge variant="muted" className="text-right">
                      {t.sector}
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-semibold tracking-tight text-foreground">
                    {t.name}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
                        role.badgeClass,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", role.dotClass)} aria-hidden />
                      {role.label}
                    </span>
                    <span className="text-[0.7rem] text-muted-foreground">{t.industry}</span>
                  </div>
                  {t.preset && (
                    <p className="mt-2 text-[0.7rem] font-medium text-brand-700">
                      Clé en main : consignes, garde-fous, outils, {t.preset.fields.length} champs à relever
                      {t.preset.callback?.enabled ? ", rappel des bips" : ""}
                    </p>
                  )}
                  <p className="mt-2 flex-1 text-sm text-muted-foreground text-pretty">
                    {t.description}
                  </p>
                  <Link
                    href={`/agents/new?template=${encodeURIComponent(t.id)}`}
                    className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-brand transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Utiliser ce modèle
                    <span className="sr-only"> : {t.name}</span>
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
