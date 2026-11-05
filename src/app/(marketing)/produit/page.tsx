import type { Metadata } from "next";
import {
  BookOpen,
  ChartNoAxesColumn,
  Megaphone,
  Mic,
  PhoneCall,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { CallJourney } from "@/components/marketing/call-journey";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import {
  Bullet,
  CtaBand,
  PageHero,
  PrimaryCta,
  ProductBento,
  Section,
  SectionHeading,
  StepsList,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Produit",
  description:
    "Agents vocaux IA qui répondent, agissent et résument chaque appel : rôles prêts à l'emploi, voix naturelles, actions pendant l'appel, campagnes et analyses.",
};

const MODULES = [
  {
    icon: Workflow,
    title: "Studio d'agent",
    body: "Créez un agent en cinq étapes : rôle, voix, consignes, actions et numéro.",
    points: ["Six rôles et des modèles par métier", "Consignes générées puis modifiables", "Test immédiat dans le navigateur"],
  },
  {
    icon: Mic,
    title: "Voix et langues",
    body: "Des voix naturelles en français, avec l'accent de votre marché.",
    points: ["Choix de la voix, du ton et du débit", "Accents européens et africains", "Interruption naturelle en cours de phrase"],
  },
  {
    icon: BookOpen,
    title: "Base de connaissances",
    body: "L'agent répond à partir de vos propres documents.",
    points: ["Import de PDF, de FAQ et de pages web", "Réponses limitées à vos contenus", "Mise à jour sans redéploiement"],
  },
  {
    icon: Zap,
    title: "Actions pendant l'appel",
    body: "L'agent ne se contente pas de prendre un message : il agit.",
    points: ["Rendez-vous dans Google Agenda ou Outlook", "Fiche client dans votre CRM", "Confirmation par SMS ou e-mail"],
  },
  {
    icon: PhoneCall,
    title: "Téléphonie",
    body: "Un numéro local ou votre ligne actuelle, en appels entrants et sortants.",
    points: ["Numéros en France, Belgique, Suisse et Canada", "Renvoi depuis votre numéro existant", "Transfert vers un humain à tout moment"],
  },
  {
    icon: Megaphone,
    title: "Campagnes sortantes",
    body: "Relances, rappels et enquêtes, planifiés à grande échelle.",
    points: ["Import de contacts par CSV", "Respect des horaires autorisés", "Suivi des résultats par contact"],
  },
  {
    icon: ChartNoAxesColumn,
    title: "Appels et analyses",
    body: "Chaque appel est enregistré, transcrit et résumé.",
    points: ["Transcription et écoute de l'enregistrement", "Résumé et issue de l'appel", "Statistiques par agent et par période"],
  },
  {
    icon: ShieldCheck,
    title: "Sécurité et conformité",
    body: "Conçu pour les exigences européennes dès le départ.",
    points: ["Données hébergées dans l'UE", "Annonce de l'IA en début d'appel", "Durée de conservation configurable"],
  },
];

export default function ProduitPage() {
  return (
    <>
      <PageHero
        eyebrow="Produit"
        title="Un agent vocal qui répond, agit et rend compte."
        subtitle="Callpme gère vos appels du début à la fin : il comprend la demande, effectue l'action et vous envoie un résumé."
      >
        <PrimaryCta href="/register">Essayer gratuitement</PrimaryCta>
        <PrimaryCta href="/tarifs" variant="ghost">Voir les tarifs</PrimaryCta>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Démo"
          title="Un appel, de la sonnerie au résumé."
          subtitle="Un client appelle un garage à 2 h du matin. Voici ce que fait l'agent."
        />
        <div className="mt-16">
          <CallJourney />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="En bref" title="L'essentiel en un coup d'œil." />
        <div className="mt-16">
          <ProductBento />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Fonctionnalités"
          title="Tout ce qu'il faut pour confier vos appels."
          subtitle="Huit modules, un seul outil. Ils fonctionnent ensemble dès la création de votre premier agent."
        />
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <BlurFade key={m.title} delay={(i % 4) * 0.06} className="h-full">
              <div className="bezel h-full">
                <div className="bezel-core flex h-full flex-col p-6">
                  <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-foreground/[0.03] text-brand">
                    <m.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                  <ul className="mt-5 space-y-2 border-t border-border pt-5">
                    {m.points.map((p) => (
                      <Bullet key={p}>{p}</Bullet>
                    ))}
                  </ul>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      </Section>

      <section className="relative overflow-hidden border-t border-border py-24 sm:py-32">
        <div aria-hidden className="glow-brand pointer-events-none absolute -left-60 top-1/3 size-[640px] opacity-60" />
        <div className="container-marketing relative">
          <SectionHeading
            eyebrow="Tableau de bord"
            title="Tous vos appels sur un seul écran."
            subtitle="Appels, rendez-vous, taux de résolution. Vous voyez ce qui fonctionne et ce qu'il faut ajuster."
          />
          <BlurFade delay={0.1} className="mt-16">
            <DashboardPreview />
          </BlurFade>
          <p className="mt-4 text-center text-xs text-muted-foreground">Aperçu avec des données d'exemple.</p>
        </div>
      </section>

      <Section>
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Mise en route"
              title="Du compte au premier appel en quinze minutes."
              subtitle="Sans intégrateur ni frais de mise en service."
            />
          </div>
          <StepsList />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
