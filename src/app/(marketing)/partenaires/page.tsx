import type { Metadata } from "next";
import { BadgePercent, Building2, LayoutDashboard, Palette } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { LeadForm, type Field } from "@/components/marketing/lead-form";
import {
  Bullet,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/marketing/sections";
import { sendPartnerRequest } from "@/app/actions/contact";

export const metadata: Metadata = {
  title: "Partenaires",
  description:
    "Programme partenaires Callpme : proposez des agents vocaux IA à vos clients, sous votre marque, avec vos propres prix.",
};

const BENEFITS = [
  { icon: Palette, title: "Votre marque", body: "Logo, couleurs et domaine personnalisés. Vos clients ne voient que vous." },
  { icon: BadgePercent, title: "Vos prix", body: "Vous fixez votre prix de revente. Callpme facture uniquement l'usage." },
  { icon: LayoutDashboard, title: "Un seul tableau de bord", body: "Tous vos clients, leurs agents et leurs appels au même endroit." },
  { icon: Building2, title: "Accompagnement", body: "Formation, supports commerciaux et un interlocuteur dédié." },
];

const FIELDS: Field[] = [
  { name: "name", label: "Nom", required: true, autoComplete: "name", half: true },
  { name: "email", label: "E-mail professionnel", type: "email", required: true, autoComplete: "email", half: true },
  { name: "agency", label: "Agence ou entreprise", required: true, autoComplete: "organization", half: true },
  { name: "country", label: "Pays", required: true, autoComplete: "country-name", half: true },
  { name: "website", label: "Site web", type: "url", autoComplete: "url", placeholder: "https://", half: true },
  {
    name: "clients",
    label: "Nombre de clients",
    type: "select",
    required: true,
    half: true,
    options: [
      { value: "1-5", label: "1 à 5" },
      { value: "6-20", label: "6 à 20" },
      { value: "21-50", label: "21 à 50" },
      { value: "50+", label: "Plus de 50" },
    ],
  },
  { name: "message", label: "Votre projet", type: "textarea", required: true, placeholder: "Vos clients, vos secteurs, ce que vous souhaitez leur proposer." },
];

export default function PartenairesPage() {
  return (
    <>
      <PageHero
        eyebrow="Partenaires"
        title="Proposez des agents vocaux sous votre marque."
        subtitle="Agences, intégrateurs et revendeurs : ajoutez une offre d'agents vocaux IA à votre catalogue, sans développer de technologie."
      />

      <section className="pb-24 sm:pb-32">
        <div className="container-marketing grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <BlurFade key={b.title} delay={i * 0.06} className="h-full">
              <div className="bezel h-full">
                <div className="bezel-core h-full p-6">
                  <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-foreground/[0.03] text-brand">
                    <b.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <h2 className="mt-5 text-base font-semibold tracking-tight text-foreground">{b.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      <Section id="demande">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Candidature"
              title="Devenir partenaire"
              subtitle="Présentez-nous votre activité. Nous revenons vers vous sous deux jours ouvrés pour un premier échange."
            />
            <ul className="mt-8 space-y-3">
              <Bullet>Sans frais d'entrée</Bullet>
              <Bullet>Forfait Agence avec marque blanche</Bullet>
              <Bullet>Démarrage accompagné avec vos premiers clients</Bullet>
            </ul>
          </div>
          <BlurFade delay={0.1}>
            <div className="bezel">
              <div className="bezel-core relative">
                <LeadForm
                  fields={FIELDS}
                  action={sendPartnerRequest}
                  submitLabel="Envoyer ma candidature"
                  successTitle="Candidature envoyée"
                  successBody="Merci. Un membre de l'équipe partenaires vous contacte sous deux jours ouvrés."
                />
              </div>
            </div>
          </BlurFade>
        </div>
      </Section>
    </>
  );
}
