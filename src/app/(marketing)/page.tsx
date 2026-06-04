import Link from "next/link";
import {
  ArrowRight,
  Check,
  Bot,
  Layers,
  Wrench,
  BarChart3,
  ShieldCheck,
  Mic,
  PhoneIncoming,
  AudioLines,
  BrainCircuit,
  Volume2,
  ChevronDown,
} from "lucide-react";
import { ALL_ROLE_META, ROLE_META } from "@/lib/agents/roles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DynamicIcon } from "@/components/icon";
import { CallPreview } from "@/components/agents/wizard/call-preview";

const STATS = [
  { value: "6", label: "rôles prêts à l'emploi" },
  { value: "3", label: "providers LLM au choix" },
  { value: "9", label: "langues supportées" },
  { value: "100%", label: "conforme RGPD" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "Multi-agents par rôle",
    text: "Créez autant d'agents que nécessaire, chacun avec un rôle, un prompt et des outils dédiés.",
  },
  {
    icon: Layers,
    title: "Providers interchangeables",
    text: "Basculez entre OpenAI, Anthropic, Mistral, Deepgram ou ElevenLabs sans réécrire votre configuration.",
  },
  {
    icon: Wrench,
    title: "Outils & function calling",
    text: "Prise de rendez-vous, recherche de commande, transfert, CRM… vos agents agissent vraiment.",
  },
  {
    icon: BarChart3,
    title: "Statistiques en temps réel",
    text: "Taux de résolution, durée moyenne, transferts, satisfaction : tout est mesuré et visible.",
  },
  {
    icon: ShieldCheck,
    title: "Garde-fous & conformité",
    text: "Fixez des limites strictes par agent et gardez le contrôle sur ce qui est dit.",
  },
  {
    icon: Mic,
    title: "Test depuis le navigateur",
    text: "Essayez vos agents au micro avant de les déployer sur un vrai numéro de téléphone.",
  },
];

const PIPELINE = [
  { icon: PhoneIncoming, title: "Appel entrant", text: "Le numéro reçoit l'appel et identifie l'agent assigné." },
  { icon: AudioLines, title: "Transcription", text: "La parole est transcrite en temps réel (STT)." },
  { icon: BrainCircuit, title: "Compréhension", text: "Le modèle raisonne avec le prompt du rôle et appelle les outils." },
  { icon: Volume2, title: "Réponse vocale", text: "La réponse est synthétisée et renvoyée à l'appelant (TTS)." },
];

const PRICING = [
  {
    id: "starter",
    name: "Starter",
    price: "49 €",
    period: "/ mois",
    desc: "Pour démarrer avec un premier agent.",
    features: ["1 agent vocal", "1 numéro inclus", "500 minutes / mois", "Statistiques de base"],
    cta: "Commencer",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "149 €",
    period: "/ mois",
    desc: "Pour les équipes qui industrialisent.",
    features: [
      "10 agents vocaux",
      "5 numéros inclus",
      "3 000 minutes / mois",
      "Statistiques avancées",
      "Tous les outils & garde-fous",
    ],
    cta: "Choisir Pro",
    highlight: true,
  },
  {
    id: "agency",
    name: "Agence",
    price: "Sur devis",
    period: "",
    desc: "Pour gérer plusieurs clients.",
    features: [
      "Agents illimités",
      "Multi-organisations",
      "Numéros à volume",
      "Support dédié",
      "Engagement SLA",
    ],
    cta: "Nous contacter",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "Qu'est-ce qu'un agent vocal avec un rôle ?",
    a: "Un agent est une entité configurable (voix, modèle, prompt, outils) à laquelle vous assignez un rôle — support, prise de rendez-vous, qualification, vente… Le rôle pré-remplit automatiquement le prompt et les outils adaptés.",
  },
  {
    q: "Puis-je changer de fournisseur d'IA ?",
    a: "Oui. Chaque agent choisit son provider LLM (OpenAI, Anthropic, Mistral), sa voix (ElevenLabs, Azure, PlayHT) et sa transcription indépendamment. Tout est interchangeable.",
  },
  {
    q: "Mes données sont-elles hébergées en France ?",
    a: "La plateforme est pensée pour la conformité RGPD avec un hébergement en Europe. Vous gardez la maîtrise de vos transcripts et de vos enregistrements.",
  },
  {
    q: "Comment fonctionne la facturation des appels ?",
    a: "Chaque offre inclut un volume de minutes. Au-delà, les minutes sont facturées à l'usage. Les numéros sont facturés séparément, à partir de 2 € par mois.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        <div
          className="pointer-events-none absolute -right-40 top-0 size-[36rem] rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, hsl(14 81% 54% / 0.10), transparent)",
          }}
        />
        <div className="container-marketing relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80 shadow-xs">
              <span className="size-1.5 rounded-full bg-brand" />
              Agents vocaux IA · Conçu en France
            </span>
            <h1 className="mt-5 text-display-xl font-semibold tracking-tight text-foreground text-balance">
              Confiez vos appels à des agents vocaux qui ont un{" "}
              <span className="text-brand">rôle</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
              Support, prise de rendez-vous, qualification, vente… Créez des
              agents vocaux IA spécialisés, déployez-les sur vos numéros et
              suivez chaque appel en temps réel.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "brand", size: "lg" }), "gap-1.5")}
              >
                Créer mon premier agent
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#roles"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Découvrir les rôles
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> Sans engagement
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> Hébergement FR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> Conforme RGPD
              </span>
            </div>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute inset-0 -m-8 rounded-[2rem] opacity-70"
              style={{
                background:
                  "radial-gradient(closest-side, hsl(14 81% 54% / 0.12), transparent)",
              }}
            />
            <div className="relative">
              <CallPreview
                name="Camille — Support"
                role="support"
                firstMessage={ROLE_META.support.firstMessage}
                voiceLabel="Adélaïde"
                language="fr-FR"
                modelLabel="GPT-4o"
                temperature={0.4}
                toolsCount={4}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="container-marketing relative pb-16">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-card px-6 py-7 text-center">
                <p className="tabular text-display-sm font-semibold tracking-tight text-foreground">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPATIBILITÉS */}
      <section className="border-t border-border py-12">
        <div className="container-marketing text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Compatible avec votre stack
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              "Twilio",
              "Zadarma",
              "OpenAI",
              "Anthropic",
              "Mistral",
              "ElevenLabs",
              "Deepgram",
              "Google Agenda",
              "HubSpot",
              "Slack",
              "Zapier",
            ].map((n) => (
              <span key={n} className="text-sm font-semibold text-foreground/40">
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section id="fonctionnalites" className="border-t border-border bg-card/40 py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Plateforme"
            title="Tout pour piloter vos agents vocaux"
            subtitle="De la création à l'analyse, chaque brique est pensée pour les équipes exigeantes."
          />
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15 [&_svg]:size-5">
                  <f.icon strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RÔLES */}
      <section id="roles" className="py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Rôles"
            title="Un rôle pour chaque besoin"
            subtitle="Chaque rôle arrive avec son prompt, ses outils et son premier message — prêt en quelques secondes."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLE_META.map((meta) => (
              <div
                key={meta.key}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={cn(
                    "inline-flex size-12 items-center justify-center rounded-xl [&_svg]:size-6",
                    meta.iconWrapClass,
                  )}
                >
                  <DynamicIcon name={meta.icon} />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight text-foreground">
                  {meta.label}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                  {meta.tagline}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {meta.defaultTools.slice(0, 3).map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="border-y border-border bg-card/40 py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Sous le capot"
            title="Le parcours d'un appel"
            subtitle="Une boucle voix temps réel, du décroché à la réponse, en moins d'une seconde de latence cible."
          />
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-foreground text-background [&_svg]:size-5">
                      <step.icon strokeWidth={1.75} />
                    </span>
                    <span className="mono text-sm font-semibold text-muted-foreground/60">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                    {step.text}
                  </p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight className="absolute -right-3.5 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground/40 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAPACITÉS */}
      <section className="py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Plateforme complète"
            title="Tout ce dont une agence a besoin"
            subtitle="De la création à la facturation, une seule plateforme pour gérer tous vos clients."
          />
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "Megaphone", title: "Campagnes sortantes", text: "Importez vos contacts, l'agent appelle toute la liste et journalise chaque issue." },
              { icon: "AudioLines", title: "Studio Voix", text: "Entraînez des voix sur-mesure et assignez-les à vos agents." },
              { icon: "Building2", title: "Multi-clients", text: "Un espace isolé par client, en marque blanche, prêt pour la revente." },
              { icon: "BookOpen", title: "Base de connaissances", text: "Vos agents répondent à partir de vos documents et de vos URLs (RAG)." },
              { icon: "Code2", title: "API & Webhooks", text: "Automatisez tout : API publique, webhooks signés, fonctions sur-mesure." },
              { icon: "Mic", title: "Test au micro", text: "Parlez à votre agent dans le navigateur avant de le déployer sur un numéro." },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15 [&_svg]:size-5">
                  <DynamicIcon name={c.icon} />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight text-foreground">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGE */}
      <section className="border-y border-border bg-card/40 py-20">
        <div className="container-marketing max-w-3xl text-center">
          <p className="text-display-sm font-medium leading-snug tracking-tight text-foreground text-balance">
            « Depuis Callpme, nous ne ratons plus un seul appel. Nos agents prennent
            les rendez-vous et qualifient les leads, jour et nuit. »
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              AM
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Aline Mercier</p>
              <p className="text-xs text-muted-foreground">Fondatrice, Agence Vox</p>
            </div>
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="py-20">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Tarifs"
            title="Une offre par maturité"
            subtitle="Commencez petit, passez à l'échelle quand vous êtes prêt."
          />
          <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-7 shadow-sm",
                  tier.highlight
                    ? "border-brand/40 ring-2 ring-brand/15"
                    : "border-border",
                )}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-brand">
                    Populaire
                  </span>
                )}
                <h3 className="font-semibold tracking-tight text-foreground">
                  {tier.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.desc}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-display-md font-semibold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.period}
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                      <span className="text-foreground/90">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${tier.id}`}
                  className={cn(
                    buttonVariants({
                      variant: tier.highlight ? "brand" : "outline",
                    }),
                    "mt-7 w-full",
                  )}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-card/40 py-20">
        <div className="container-marketing max-w-3xl">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions fréquentes"
            subtitle=""
          />
          <div className="mt-10 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground">
                  {item.q}
                  <ChevronDown className="faq-chevron size-4 shrink-0 text-muted-foreground" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container-marketing">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-14 text-center shadow-xl sm:px-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(closest-side at 50% 0%, hsl(14 81% 54% / 0.30), transparent)",
              }}
            />
            <h2 className="relative text-display-md font-semibold tracking-tight text-background text-balance">
              Prêt à déployer votre premier agent ?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-background/70 text-pretty">
              Configurez un agent vocal complet en quelques minutes. Aucune carte
              bancaire requise pour commencer.
            </p>
            <div className="relative mt-7 flex justify-center">
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "brand", size: "lg" }), "gap-1.5")}
              >
                Créer mon compte gratuitement
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-display-md font-semibold tracking-tight text-foreground text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-lg text-muted-foreground text-pretty">
          {subtitle}
        </p>
      )}
    </div>
  );
}
