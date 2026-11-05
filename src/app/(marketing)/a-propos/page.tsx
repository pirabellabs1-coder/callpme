import type { Metadata } from "next";
import { ExternalLink, Globe2, ShieldCheck, Code2 } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  CtaBand,
  PageHero,
  PrimaryCta,
  Section,
  SectionHeading,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "À propos",
  description: "Callpme rend les agents vocaux IA accessibles aux entreprises d'Europe et d'Afrique francophone. Une solution Pirabel Labs.",
};

const VALUES = [
  { icon: Globe2, title: "Pensé pour la francophonie", body: "Voix, accents, numéros et moyens de paiement adaptés à l'Europe et à l'Afrique francophone." },
  { icon: ShieldCheck, title: "Conforme par défaut", body: "Données hébergées dans l'UE, RGPD et transparence sur l'usage de l'IA dès la première version." },
  { icon: Code2, title: "Ouvert aux intégrations", body: "Tout ce que fait le tableau de bord est aussi disponible par API." },
];

export default function AProposPage() {
  return (
    <>
      <PageHero
        eyebrow="À propos"
        title="Des agents vocaux IA accessibles à toutes les entreprises."
        subtitle="Callpme permet aux PME, aux agences et aux développeurs de créer et de piloter des agents vocaux qui répondent, agissent et rendent compte."
      >
        <PrimaryCta href="/register">Créer un agent</PrimaryCta>
        <PrimaryCta href="/contact" variant="ghost">Nous contacter</PrimaryCta>
      </PageHero>

      <section className="pb-24 sm:pb-32">
        <div className="container-marketing grid gap-4 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <BlurFade key={v.title} delay={i * 0.06} className="h-full">
              <div className="bezel h-full">
                <div className="bezel-core h-full p-7">
                  <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-foreground/[0.03] text-brand">
                    <v.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{v.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <SectionHeading
            align="left"
            eyebrow="Pirabel Labs"
            title="Conçu et opéré par Pirabel Labs."
            subtitle="Callpme est développé par Pirabel Labs, une agence qui conçoit et exploite des produits numériques sur mesure."
          />
          <BlurFade delay={0.1}>
            <div className="bezel">
              <div className="bezel-core p-8">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  L'équipe accompagne aussi les entreprises et les agences qui souhaitent intégrer Callpme
                  à leurs outils ou le proposer à leurs propres clients.
                </p>
                <a
                  href="https://pirabellabs.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Découvrir Pirabel Labs
                  <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              </div>
            </div>
          </BlurFade>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
