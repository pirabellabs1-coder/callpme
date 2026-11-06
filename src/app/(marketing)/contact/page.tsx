import type { Metadata } from "next";
import { Clock, ExternalLink, LifeBuoy, Mail } from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { LeadForm, type Field } from "@/components/marketing/lead-form";
import { PageHero } from "@/components/marketing/sections";
import { sendContact } from "@/app/actions/contact";

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question, une démo ou un projet ? Écrivez à l'équipe Callpme, réponse sous un jour ouvré.",
};

const FIELDS: Field[] = [
  { name: "name", label: "Nom", required: true, autoComplete: "name", half: true },
  { name: "email", label: "E-mail professionnel", type: "email", required: true, autoComplete: "email", half: true },
  { name: "company", label: "Entreprise", autoComplete: "organization", half: true },
  {
    name: "subject",
    label: "Sujet",
    type: "select",
    required: true,
    half: true,
    options: [
      { value: "demo", label: "Demande de démo" },
      { value: "commercial", label: "Question commerciale" },
      { value: "support", label: "Support" },
      { value: "presse", label: "Presse" },
      { value: "autre", label: "Autre" },
    ],
  },
  { name: "message", label: "Message", type: "textarea", required: true, placeholder: "Décrivez votre besoin en quelques lignes." },
];

const INFOS = [
  { icon: Clock, title: "Réponse sous un jour ouvré", body: "Du lundi au vendredi, de 9 h à 18 h (heure de Paris)." },
  { icon: Mail, title: "Par e-mail", body: "contact@pirabellabs.com", href: "mailto:contact@pirabellabs.com" },
  { icon: LifeBuoy, title: "Déjà client ?", body: "Le support est aussi accessible depuis votre tableau de bord." },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Parlons de votre projet."
        subtitle="Une question, une démo ou un besoin particulier ? Laissez-nous un message, nous vous répondons rapidement."
      />

      <section className="pb-24 sm:pb-32">
        <div className="container-marketing grid gap-10 lg:grid-cols-[1.4fr_0.6fr]">
          <BlurFade>
            <div className="bezel">
              <div className="bezel-core relative">
                <LeadForm
                  fields={FIELDS}
                  action={sendContact}
                  submitLabel="Envoyer le message"
                  successTitle="Message envoyé"
                  successBody="Merci. Nous revenons vers vous sous un jour ouvré, à l'adresse indiquée."
                />
              </div>
            </div>
          </BlurFade>

          <BlurFade delay={0.1}>
            <ul className="space-y-8 lg:pt-4">
              {INFOS.map((i) => (
                <li key={i.title} className="flex gap-4">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-foreground/[0.03] text-brand">
                    <i.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{i.title}</p>
                    {i.href ? (
                      <a href={i.href} className="mt-1 block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                        {i.body}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{i.body}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </BlurFade>
        </div>
      </section>

      <section className="border-t border-border py-24 sm:py-28">
        <div className="container-marketing grid items-center gap-10 lg:grid-cols-2">
          <BlurFade>
            <span className="eyebrow">Qui sommes-nous</span>
            <h2 className="mt-5 text-display-md font-semibold tracking-tight text-foreground text-balance">
              Callpme est conçu et opéré par Pirabel Labs.
            </h2>
          </BlurFade>
          <BlurFade delay={0.1}>
            <p className="text-base leading-relaxed text-muted-foreground">
              Pirabel Labs conçoit et exploite des produits numériques sur mesure. L'équipe développe Callpme pour
              rendre les agents vocaux IA accessibles aux entreprises d'Europe et d'Afrique francophone, et accompagne
              celles qui souhaitent l'intégrer à leurs outils.
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
          </BlurFade>
        </div>
      </section>
    </>
  );
}
