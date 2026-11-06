import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { PLANS, API_PRICE } from "./content";
import { TRADES } from "./trades-data";
import { PrimaryCta } from "./sections";

/**
 * Aperçus de la page d'accueil : chacun résume un sujet et renvoie vers la
 * page détaillée, sans dupliquer son contenu.
 */

/** Grille de cartes photo, une par métier, vers /metiers#<secteur>. */
export function TradesTeaser() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {TRADES.map((t, i) => (
        <BlurFade key={t.key} delay={i * 0.05}>
          <Link
            href={`/metiers#${t.key}`}
            className="group relative block aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-foreground/10"
          >
            <Image
              src={t.photo}
              alt={t.alt}
              fill
              sizes="(min-width: 1024px) 190px, (min-width: 768px) 30vw, 45vw"
              className="object-cover transition-transform duration-700 ease-spring group-hover:scale-105"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <span className="text-sm font-medium leading-tight text-white">{t.label}</span>
              <ArrowUpRight className="size-4 shrink-0 text-white/70 transition-transform duration-300 ease-spring group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden />
            </span>
          </Link>
        </BlurFade>
      ))}
    </div>
  );
}

/** Bandeau développeurs : promesse + mini-terminal, renvoie vers /developpeurs. */
export function DevTeaser() {
  return (
    <div className="bezel">
      <div className="bezel-core grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">Développeurs</span>
          <h2 className="mt-5 text-display-md font-semibold tracking-tight text-foreground text-balance">
            Intégrez Callpme à vos propres outils.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            API REST, clés d'API et webhooks signés. À partir de {API_PRICE} la minute, voix, transcription et téléphonie comprises.
          </p>
          <div className="mt-8">
            <PrimaryCta href="/developpeurs" variant="ghost">Découvrir l'API</PrimaryCta>
          </div>
        </div>
        <div aria-hidden className="rounded-2xl border border-border bg-background/70 p-5 font-mono text-[13px] leading-7">
          <p className="text-muted-foreground">
            <span className="text-brand">POST</span> /api/v1/agents
          </p>
          <p className="text-success">201 Created</p>
          <p className="mt-3 text-muted-foreground">
            <span className="text-brand">webhook</span> call.completed
          </p>
          <p className="text-foreground">{"{ durationSec: 112, goalAchieved: true }"}</p>
        </div>
      </div>
    </div>
  );
}

/** Aperçu tarifaire compact, renvoie vers /tarifs. */
export function PricingTeaser() {
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <Link
            key={p.name}
            href="/tarifs"
            className="group flex items-baseline justify-between rounded-2xl border border-border bg-foreground/[0.02] px-5 py-4 transition-colors hover:bg-foreground/[0.05]"
          >
            <span className="text-sm font-medium text-foreground">{p.name}</span>
            <span className="text-sm text-muted-foreground">
              {p.price ? (
                <>
                  <span className="text-xl font-semibold text-foreground tabular">{p.price} €</span> / mois
                </>
              ) : (
                <span className="text-base font-semibold text-foreground">Sur devis</span>
              )}
            </span>
          </Link>
        ))}
      </div>
      <PrimaryCta href="/tarifs" variant="ghost">Comparer les forfaits</PrimaryCta>
    </div>
  );
}
