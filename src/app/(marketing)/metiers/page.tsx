import type { Metadata } from "next";
import {
  BedDouble,
  Car,
  GraduationCap,
  Home,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { TradesShowcase } from "@/components/marketing/trades-showcase";
import {
  CtaBand,
  PageHero,
  PrimaryCta,
  Section,
  SectionHeading,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Métiers",
  description:
    "Des agents vocaux adaptés à votre secteur : santé, coiffure, avocats, garages, immobilier, restauration, commerce et plus encore.",
};

const OTHER_SECTORS = [
  { icon: ShoppingBag, title: "E-commerce", body: "Suivi de commande, retours et questions sur les produits." },
  { icon: BedDouble, title: "Hôtellerie", body: "Réservations, disponibilités et demandes des clients avant leur arrivée." },
  { icon: ShieldCheck, title: "Assurance", body: "Premier recueil d'un sinistre et orientation vers le bon conseiller." },
  { icon: Car, title: "Auto-écoles", body: "Inscriptions, planning des leçons et rappels d'examen." },
  { icon: Home, title: "Services à domicile", body: "Demandes d'intervention, devis et créneaux de passage." },
  { icon: GraduationCap, title: "Formation", body: "Renseignements sur les cursus, inscriptions et rappels de session." },
];

export default function MetiersPage() {
  return (
    <>
      <PageHero
        eyebrow="Métiers"
        title="Un agent qui connaît votre métier."
        subtitle="Chaque modèle reprend le vocabulaire, les questions et les règles de son secteur. Vous l'adaptez ensuite à votre entreprise."
      >
        <PrimaryCta href="/register">Créer mon agent</PrimaryCta>
        <PrimaryCta href="/contact" variant="ghost">Parler à un conseiller</PrimaryCta>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Exemples"
          title="Six secteurs, six façons de répondre."
          subtitle="Choisissez un secteur pour voir ce que fait l'agent et un extrait d'appel."
        />
        <div className="mt-14">
          <TradesShowcase />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Et aussi"
          title="Votre secteur n'est pas dans la liste ?"
          subtitle="Les mêmes briques s'adaptent à toute activité qui reçoit des appels."
        />
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_SECTORS.map((s, i) => (
            <BlurFade key={s.title} delay={(i % 3) * 0.06} className="h-full">
              <div className="bezel h-full">
                <div className="bezel-core flex h-full items-start gap-4 p-6">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-foreground/[0.03] text-brand">
                    <s.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      </Section>

      <CtaBand
        title="Un modèle pour votre métier, prêt en quinze minutes."
        subtitle="Partez d'un modèle, ajustez-le à votre entreprise et testez-le avant de payer."
        label="Créer mon agent"
      />
    </>
  );
}
