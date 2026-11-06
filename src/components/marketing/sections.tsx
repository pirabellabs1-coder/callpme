import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  ChartNoAxesColumn,
  Code2,
  Globe2,
  Smartphone,
  Workflow,
} from "lucide-react";
import { ALL_ROLE_META } from "@/lib/agents/roles";
import { DynamicIcon } from "@/components/icon";
import { BlurFade } from "@/components/magicui/blur-fade";
import { CodeTabs } from "@/components/dev/code-block";
import { cn } from "@/lib/utils";
import {
  API_PRICE,
  AUDIENCES,
  CODE_SAMPLES,
  FAQ,
  PLANS,
  STEPS,
  WEBHOOK_SAMPLE,
} from "./content";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  as: Tag = "h2",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  as?: "h1" | "h2";
}) {
  return (
    <BlurFade className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <span className="eyebrow">{eyebrow}</span>
      <Tag
        className={cn(
          "mt-5 font-semibold tracking-tight text-foreground text-balance",
          Tag === "h1" ? "text-display-xl" : "text-display-lg",
        )}
      >
        {title}
      </Tag>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{subtitle}</p>
      )}
    </BlurFade>
  );
}

/** En-tête d'une page intérieure (h1), avec halo de marque. */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pb-16 pt-36 sm:pb-20 sm:pt-44">
      <div aria-hidden className="noise-overlay" />
      <div aria-hidden className="glow-brand pointer-events-none absolute left-1/2 top-0 size-[720px] -translate-x-1/2 opacity-60" />
      <div aria-hidden className="bg-grid mask-fade-b pointer-events-none absolute inset-0 opacity-50" />
      <div className="container-marketing relative">
        <SectionHeading as="h1" eyebrow={eyebrow} title={title} subtitle={subtitle} />
        {children && <BlurFade delay={0.15} className="mt-10 flex flex-wrap justify-center gap-3">{children}</BlurFade>}
      </div>
    </section>
  );
}

/** Section standard avec séparateur haut. */
export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("border-t border-border py-24 sm:py-32", className)}>
      <div className="container-marketing">{children}</div>
    </section>
  );
}

export function BentoCard({
  className,
  icon,
  title,
  body,
  children,
}: {
  className?: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <BlurFade className={cn("h-full", className)}>
      <div className="bezel h-full">
        <div className="bezel-core h-full p-7 transition-colors duration-500 ease-spring hover:bg-popover">
          <span className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-foreground/[0.03] text-brand">
            {icon}
          </span>
          <h3 className="mt-6 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
          {children}
        </div>
      </div>
    </BlurFade>
  );
}

/** Bouton pilule avec icône nichée dans son propre cercle (« button-in-button »). */
export function PrimaryCta({
  href,
  children,
  variant = "primary",
  full = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "brand" | "ghost";
  full?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center justify-between gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-medium transition-transform duration-300 ease-spring active:scale-[0.98]",
        full && "w-full",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "brand" && "bg-brand text-brand-foreground shadow-brand",
        variant === "ghost" && "border border-border bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.06]",
      )}
    >
      {children}
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full transition-transform duration-300 ease-spring group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105",
          variant === "primary" ? "bg-primary-foreground/10" : "bg-foreground/10",
        )}
      >
        <ArrowUpRight className="size-4" strokeWidth={1.75} />
      </span>
    </Link>
  );
}

export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-foreground">
      <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Blocs réutilisés sur plusieurs pages                                */
/* ------------------------------------------------------------------ */

export function ProductBento() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <BentoCard className="md:col-span-4" icon={<Workflow className="size-5" strokeWidth={1.5} />} title="Choisissez le rôle de votre agent" body="Standard, rendez-vous, support, qualification, vente, enquête. Chaque rôle est prêt à l'emploi, avec ses consignes et ses actions.">
        <div className="mt-8 flex flex-wrap gap-2">
          {ALL_ROLE_META.map((r) => (
            <span key={r.key} className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 text-xs text-foreground">
              <DynamicIcon name={r.icon} className="size-3.5 text-brand" strokeWidth={1.5} />
              {r.label}
            </span>
          ))}
        </div>
      </BentoCard>
      <BentoCard className="md:col-span-2" icon={<Smartphone className="size-5" strokeWidth={1.5} />} title="Payez par Mobile Money" body="Réglez en FCFA avec Orange Money, MTN, Wave ou Moov, sans carte internationale." />
      <BentoCard className="md:col-span-2" icon={<Globe2 className="size-5" strokeWidth={1.5} />} title="Obtenez un numéro local" body="Disponible en France, en Belgique, en Suisse et au Canada. L'Afrique de l'Ouest suivra." />
      <BentoCard className="md:col-span-2" icon={<CalendarCheck className="size-5" strokeWidth={1.5} />} title="Votre agent agit pendant l'appel" body="Il réserve dans votre agenda, crée la fiche dans votre CRM et envoie la confirmation par SMS à votre client." />
      <BentoCard className="md:col-span-2" icon={<BookOpen className="size-5" strokeWidth={1.5} />} title="Il connaît votre entreprise" body="Importez vos PDF, votre FAQ ou votre site. Votre agent répond à partir de vos documents." />
      <BentoCard className="md:col-span-3" icon={<ChartNoAxesColumn className="size-5" strokeWidth={1.5} />} title="Vous recevez un résumé de chaque appel" body="Transcription, enregistrement, résumé et issue de l'appel. Vos statistiques montrent ce que vos clients demandent." />
      <BentoCard className="md:col-span-3" icon={<Code2 className="size-5" strokeWidth={1.5} />} title="Pilotez tout par API" body="API REST, clés d'API et webhooks signés. Tout ce que vous faites dans le tableau de bord est aussi disponible par API." />
    </div>
  );
}

export function AudienceCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {AUDIENCES.map((a, i) => (
        <BlurFade key={a.key} delay={i * 0.08} className="h-full">
          <div className="bezel h-full">
            <div className="bezel-core flex h-full flex-col p-7">
              <span className="eyebrow w-fit">{a.tag}</span>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              <ul className="mt-6 space-y-2.5">
                {a.points.map((p) => (
                  <Bullet key={p}>{p}</Bullet>
                ))}
              </ul>
              <Link href={a.href} className="group mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-medium text-foreground">
                {a.cta}
                <ArrowUpRight className="size-4 transition-transform duration-300 ease-spring group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </BlurFade>
      ))}
    </div>
  );
}

export function CodeShowcase() {
  return (
    <BlurFade delay={0.1} className="min-w-0 space-y-4">
      <div className="bezel">
        <div className="bezel-core p-4 sm:p-5">
          <CodeTabs samples={CODE_SAMPLES} />
        </div>
      </div>
      <div className="bezel">
        <div className="bezel-core p-4 sm:p-5">
          <CodeTabs samples={WEBHOOK_SAMPLE} />
        </div>
      </div>
    </BlurFade>
  );
}

export function StepsList() {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {STEPS.map((s, i) => (
        <BlurFade key={s.n} as="li" delay={i * 0.06} className="grid gap-4 py-8 sm:grid-cols-[80px_1fr]">
          <span className="mono text-sm text-brand">{s.n}</span>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        </BlurFade>
      ))}
    </ol>
  );
}

export function PricingCards() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <BlurFade key={p.name} delay={i * 0.08} className="h-full">
            <div className={cn("bezel h-full", p.highlight && "ring-brand/40")}>
              <div className="bezel-core flex h-full flex-col p-7">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                  {p.highlight && <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand">Recommandé</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.tagline}</p>
                {p.price ? (
                  <>
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-5xl font-semibold tracking-tight text-foreground tabular">{p.price} €</span>
                      <span className="text-sm text-muted-foreground">HT / mois</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">soit environ {p.fcfa} FCFA</p>
                  </>
                ) : (
                  <p className="mt-6 text-4xl font-semibold tracking-tight text-foreground">Sur devis</p>
                )}
                <p className="mt-6 text-sm text-foreground">{p.minutes}</p>
                <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
                  {p.features.map((f) => (
                    <Bullet key={f}>{f}</Bullet>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <PrimaryCta href={p.price ? "/register" : "/partenaires"} variant={p.highlight ? "brand" : "ghost"} full>
                    {p.price ? "Commencer" : "Nous contacter"}
                  </PrimaryCta>
                </div>
              </div>
            </div>
          </BlurFade>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Vous êtes développeur ? {API_PRICE} la minute tout compris, facturé à l'usage.{" "}
        <Link href="/developpeurs" className="text-foreground underline underline-offset-4">Voir l'API</Link>
      </p>
    </>
  );
}

export function FaqList({ items = FAQ }: { items?: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((f) => (
        <details key={f.q} className="group py-6">
          <summary className="flex cursor-pointer items-center justify-between gap-6 text-base font-medium text-foreground">
            {f.q}
            <span aria-hidden className="relative size-4 shrink-0">
              <span className="absolute inset-x-0 top-1/2 h-px bg-foreground" />
              <span className="absolute inset-y-0 left-1/2 w-px bg-foreground transition-transform duration-300 ease-spring group-open:rotate-90 group-open:opacity-0" />
            </span>
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Bandeau d'appel à l'action de fin de page. */
export function CtaBand({
  title = "Ne laissez plus un appel sans réponse.",
  subtitle = "Créez votre agent et testez-le gratuitement. Vous choisirez votre forfait ensuite.",
  href = "/register",
  label = "Essayer gratuitement",
}: {
  title?: string;
  subtitle?: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="pb-24 sm:pb-32">
      <div className="container-marketing">
        <div className="bezel">
          <div className="bezel-core relative overflow-hidden px-6 py-20 text-center sm:px-16">
            <div aria-hidden className="glow-brand pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2" />
            <h2 className="relative mx-auto max-w-2xl text-display-lg font-semibold tracking-tight text-foreground text-balance">{title}</h2>
            <p className="relative mx-auto mt-5 max-w-lg text-muted-foreground">{subtitle}</p>
            <div className="relative mt-10 flex justify-center">
              <PrimaryCta href={href}>{label}</PrimaryCta>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Gabarit des pages légales (CGU, confidentialité…). */
export function LegalPage({
  eyebrow = "Légal",
  title,
  updated,
  sections,
  children,
}: {
  eyebrow?: string;
  title: string;
  updated: string;
  sections: { h: string; p: string }[];
  children?: React.ReactNode;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} subtitle={updated} />
      <section className="pb-24 sm:pb-32">
        <div className="container-marketing">
          <div className="bezel mx-auto max-w-3xl">
            <div className="bezel-core space-y-10 p-7 sm:p-12">
              {sections.map((s) => (
                <section key={s.h}>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{s.h}</h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">{s.p}</p>
                </section>
              ))}
              {children}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
