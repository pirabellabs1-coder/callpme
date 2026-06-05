import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "À propos · Callpme" };

export default function AProposPage() {
  return (
    <div className="container-marketing py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          À propos
        </p>
        <h1 className="mt-2 text-display-lg font-semibold tracking-tight text-foreground text-balance">
          La plateforme française des agents vocaux IA.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground text-pretty">
          Callpme permet à n'importe quelle entreprise de créer, déployer et
          piloter des agents vocaux IA spécialisés — support, prise de
          rendez-vous, qualification, vente — par API ou depuis un tableau de
          bord, en français et conforme RGPD.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">
            Une solution Pirabel Labs
          </p>
          <h2 className="mt-2 text-display-sm font-semibold tracking-tight text-foreground">
            Conçu et opéré par Pirabel Labs
          </h2>
          <p className="mt-3 text-muted-foreground text-pretty">
            Callpme est l'une des réalisations de{" "}
            <strong className="text-foreground">Pirabel Labs</strong>, l'agence
            qui conçoit et opère des produits numériques sur-mesure. Pirabel Labs
            est l'agence principale à l'origine de la création de Callpme.
          </p>
          <a
            href="https://pirabellabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            Découvrir Pirabel Labs
            <ExternalLink className="size-4" />
          </a>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {[
            { v: "France", l: "Conçu et hébergé en Europe" },
            { v: "RGPD", l: "Conformité et maîtrise des données" },
            { v: "API-first", l: "Tout est pilotable par API" },
          ].map((s) => (
            <div key={s.v} className="rounded-xl border border-border bg-card p-5">
              <p className="text-display-sm font-semibold tracking-tight text-foreground">
                {s.v}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link href="/register" className={cn(buttonVariants({ variant: "brand", size: "lg" }), "gap-1.5")}>
            Créer un agent
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/contact" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}
