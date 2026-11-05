import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  CtaBand,
  FaqList,
  PageHero,
  PricingCards,
  Section,
  SectionHeading,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Forfaits mensuels sans engagement, minutes incluses, paiement par carte ou Mobile Money. Offre à l'usage pour les développeurs.",
};

type Cell = boolean | string;
const COMPARISON: { group: string; rows: { label: string; values: [Cell, Cell, Cell] }[] }[] = [
  {
    group: "Usage",
    rows: [
      { label: "Minutes incluses par mois", values: ["100", "500", "3 000"] },
      { label: "Minute supplémentaire", values: ["0,25 €", "0,20 €", "0,14 €"] },
      { label: "Agents", values: ["1", "5", "Illimités"] },
      { label: "Numéros locaux", values: ["1", "3", "10"] },
    ],
  },
  {
    group: "Fonctionnalités",
    rows: [
      { label: "Prise de rendez-vous", values: [true, true, true] },
      { label: "Base de connaissances", values: [true, true, true] },
      { label: "Campagnes sortantes", values: [false, true, true] },
      { label: "Intégrations CRM", values: [false, true, true] },
      { label: "API et webhooks", values: [false, true, true] },
    ],
  },
  {
    group: "Agences",
    rows: [
      { label: "Marque blanche", values: [false, false, true] },
      { label: "Espaces clients illimités", values: [false, false, true] },
      { label: "Refacturation à marge", values: [false, false, true] },
    ],
  },
  {
    group: "Support",
    rows: [
      { label: "Support", values: ["E-mail", "Prioritaire", "Dédié"] },
    ],
  },
];

const BILLING_FAQ = [
  { q: "Puis-je changer de forfait à tout moment ?", a: "Oui. Le changement prend effet immédiatement et la différence est calculée au prorata." },
  { q: "Que se passe-t-il si je dépasse mes minutes ?", a: "Les minutes supplémentaires sont facturées au tarif de votre forfait. Vous pouvez fixer un plafond dans vos réglages." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Carte bancaire, Orange Money, MTN Mobile Money, Wave et Moov Money. La facturation est possible en euros ou en FCFA." },
  { q: "Y a-t-il un engagement ?", a: "Non. Les forfaits sont mensuels et résiliables à tout moment. Une remise de 20 % s'applique au paiement annuel." },
  { q: "Les prix incluent-ils la TVA ?", a: "Les prix sont indiqués hors taxes. La TVA applicable dans votre pays est ajoutée à la facture." },
];

const PLAN_NAMES = ["Starter", "Pro", "Agence"];

function CellValue({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto size-4 text-brand" strokeWidth={2} aria-label="Inclus" />;
  if (v === false) return <Minus className="mx-auto size-4 text-muted-foreground/50" strokeWidth={2} aria-label="Non inclus" />;
  return <span className="text-foreground">{v}</span>;
}

export default function TarifsPage() {
  return (
    <>
      <PageHero
        eyebrow="Tarifs"
        title="Des forfaits simples, sans engagement."
        subtitle="Les minutes incluses couvrent la voix, la transcription et la téléphonie. Payez par carte ou par Mobile Money."
      />

      <section className="pb-24 sm:pb-32">
        <div className="container-marketing">
          <PricingCards />
        </div>
      </section>

      <Section>
        <SectionHeading eyebrow="Comparatif" title="Ce que contient chaque forfait." />
        <BlurFade delay={0.1} className="mx-auto mt-14 max-w-4xl">
          <div className="bezel">
            <div className="bezel-core overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Comparatif des forfaits Starter, Pro et Agence</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Fonctionnalité
                    </th>
                    {PLAN_NAMES.map((n) => (
                      <th key={n} scope="col" className="px-5 py-4 text-center text-sm font-semibold text-foreground">
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                {COMPARISON.map((g) => (
                  <tbody key={g.group}>
                    <tr className="bg-foreground/[0.02]">
                      <th colSpan={4} scope="colgroup" className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {g.group}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.label} className="border-t border-border">
                        <th scope="row" className="px-5 py-3.5 text-left font-normal text-muted-foreground">{r.label}</th>
                        {r.values.map((v, i) => (
                          <td key={i} className="px-5 py-3.5 text-center">
                            <CellValue v={v} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </BlurFade>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prix hors taxes. Tarifs de lancement susceptibles d'évoluer.
        </p>
      </Section>

      <Section>
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            align="left"
            eyebrow="Facturation"
            title="Questions sur la facturation"
            subtitle="Une question sur un devis ou un volume important ? Contactez-nous."
          />
          <FaqList items={BILLING_FAQ} />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
