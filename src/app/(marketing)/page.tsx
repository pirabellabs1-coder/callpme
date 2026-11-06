import Link from "next/link";
import { Globe2 } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Marquee } from "@/components/magicui/marquee";
import { HeroCallScene } from "@/components/marketing/hero-call-scene";
import { CallJourney } from "@/components/marketing/call-journey";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { MARKETS } from "@/components/marketing/content";
import { DevTeaser, PricingTeaser, TradesTeaser } from "@/components/marketing/teasers";
import {
  AudienceCards,
  CtaBand,
  FaqList,
  PrimaryCta,
  ProductBento,
  Section,
  SectionHeading,
  StepsList,
} from "@/components/marketing/sections";

export default function LandingPage() {
  return (
    <>
      <div aria-hidden className="noise-overlay" />

      {/* HERO — split éditorial : titre à gauche, appel en direct à droite */}
      <section className="relative overflow-hidden pt-32 sm:pt-40">
        <div aria-hidden className="glow-brand pointer-events-none absolute -right-40 top-10 size-[720px] opacity-70" />
        <div aria-hidden className="bg-grid mask-fade-b pointer-events-none absolute inset-0 opacity-60" />

        <div className="container-marketing relative grid items-center gap-16 pb-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-32">
          <div>
            <BlurFade>
              <span className="eyebrow">
                <span className="size-1.5 rounded-full bg-brand" />
                Agents vocaux IA · Europe et Afrique francophone
              </span>
            </BlurFade>
            <BlurFade delay={0.08}>
              <h1 className="mt-6 text-display-2xl font-semibold tracking-tight text-foreground text-balance">
                Répondez à tous vos appels, à toute heure.
              </h1>
            </BlurFade>
            <BlurFade delay={0.16}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                Votre agent vocal décroche à votre place. Il prend vos rendez-vous, qualifie
                vos demandes et vous transfère les urgences. Vous retrouvez chaque appel
                transcrit et résumé dans votre tableau de bord.
              </p>
            </BlurFade>
            <BlurFade delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <PrimaryCta href="/contact">Demander une démo</PrimaryCta>
                <Link
                  href="/produit"
                  className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Voir ce que fait votre agent
                </Link>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Démo personnalisée par notre équipe · Mobile Money ou carte · Données hébergées dans l'UE
              </p>
            </BlurFade>
          </div>

          <BlurFade delay={0.2} className="flex justify-center lg:justify-end">
            <HeroCallScene callerSrc="/hero/caller-square.webp" />
          </BlurFade>
        </div>
      </section>

      {/* MARCHÉS */}
      <section aria-label="Pays couverts" className="border-y border-border py-6">
        <Marquee className="[--duration:40s] [--gap:3rem]">
          {MARKETS.map((m) => (
            <span key={m} className="flex items-center gap-3 text-sm text-muted-foreground">
              <Globe2 className="size-4" strokeWidth={1.5} aria-hidden />
              {m}
            </span>
          ))}
        </Marquee>
      </section>

      {/* DÉMO — un appel de bout en bout */}
      <section id="demo" className="py-24 sm:py-32">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Démo"
            title="Votre agent gère l'appel, de la sonnerie au résumé."
            subtitle="Un client appelle votre garage à 2 h du matin. Voici ce que fait votre agent pendant que vous dormez."
          />
          <div className="mt-16">
            <CallJourney />
          </div>
        </div>
      </section>

      <Section id="produit">
        <SectionHeading
          eyebrow="Produit"
          title="Gérez tous vos appels depuis un seul outil."
          subtitle="Votre agent gère chaque appel du début à la fin, puis vous en donne le compte rendu. Paiement, numéros et voix sont adaptés à votre marché."
        />
        <div className="mt-16">
          <ProductBento />
        </div>
        <div className="mt-10 flex justify-center">
          <PrimaryCta href="/produit" variant="ghost">Voir le produit en détail</PrimaryCta>
        </div>
      </Section>

      <Section id="metiers">
        <SectionHeading
          eyebrow="Métiers"
          title="Votre agent parle le langage de votre métier."
          subtitle="Chaque modèle connaît le vocabulaire et les questions courantes de son secteur."
        />
        <div className="mt-14">
          <TradesTeaser />
        </div>
        <div className="mt-10 flex justify-center">
          <PrimaryCta href="/metiers" variant="ghost">Voir les exemples par métier</PrimaryCta>
        </div>
      </Section>

      {/* TABLEAU DE BORD */}
      <section className="relative overflow-hidden border-t border-border py-24 sm:py-32">
        <div aria-hidden className="glow-brand pointer-events-none absolute -left-60 top-1/3 size-[640px] opacity-60" />
        <div className="container-marketing relative">
          <SectionHeading
            eyebrow="Tableau de bord"
            title="Suivez tous vos appels sur un seul écran."
            subtitle="Appels, rendez-vous, taux de résolution. Vous voyez ce qui fonctionne et ce qu'il faut ajuster."
          />
          <BlurFade delay={0.1} className="mt-16">
            <DashboardPreview />
          </BlurFade>
          <p className="mt-4 text-center text-xs text-muted-foreground">Aperçu avec des données d'exemple.</p>
        </div>
      </section>

      <Section id="pour-qui">
        <SectionHeading
          eyebrow="Pour qui"
          title="Callpme s'adapte à votre activité."
          subtitle="Que vous dirigiez une PME, une agence ou une équipe technique, vous utilisez la même plateforme."
        />
        <div className="mt-16">
          <AudienceCards />
        </div>
      </Section>

      <section id="developpeurs" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing">
          <DevTeaser />
        </div>
      </section>

      <Section>
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Mise en route"
              title="Votre agent répond à son premier appel en quinze minutes."
              subtitle="Vous le configurez vous-même, sans intégrateur ni frais de mise en service."
            />
          </div>
          <StepsList />
        </div>
      </Section>

      <Section id="tarifs">
        <SectionHeading
          eyebrow="Tarifs"
          title="Choisissez votre forfait, sans engagement."
          subtitle="Vos minutes incluent la voix, la transcription et la téléphonie. Vous ne payez aucun frais caché."
        />
        <div className="mt-14">
          <PricingTeaser />
        </div>
      </Section>

      <Section id="faq">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading align="left" eyebrow="Questions" title="Vos questions" subtitle="Vous ne trouvez pas votre réponse ? Écrivez-nous depuis la page contact." />
          <FaqList />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
