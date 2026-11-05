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
import { Marquee } from "@/components/magicui/marquee";
import { HeroCallScene } from "@/components/marketing/hero-call-scene";
import { CallJourney } from "@/components/marketing/call-journey";
import { TradesShowcase } from "@/components/marketing/trades-showcase";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { CodeTabs } from "@/components/dev/code-block";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Données de la page                                                  */
/* ------------------------------------------------------------------ */

const MARKETS = [
  "France",
  "Belgique",
  "Suisse",
  "Québec",
  "Côte d'Ivoire",
  "Sénégal",
  "Cameroun",
  "Bénin",
  "Togo",
  "Mali",
];

const AUDIENCES = [
  {
    key: "pme",
    tag: "PME",
    title: "Un standard qui ne rate plus d'appel",
    body: "Cabinets, garages, agences immobilières, cliniques. Votre agent répond la nuit, le week-end et pendant les rushs, prend les rendez-vous et vous envoie un résumé de chaque appel.",
    points: ["Mise en ligne en 15 minutes", "Votre numéro actuel conservé", "Payable en Mobile Money"],
    href: "/register",
    cta: "Créer mon agent",
  },
  {
    key: "agence",
    tag: "Agences",
    title: "Vendez des agents vocaux sous votre marque",
    body: "Un espace par client, vos couleurs, votre domaine. Vous fixez le prix de revente, Callpme facture uniquement l'usage.",
    points: ["Marque blanche complète", "Clients illimités", "Tableau de bord multi-clients"],
    href: "/register?offre=agence",
    cta: "Ouvrir un compte agence",
  },
  {
    key: "dev",
    tag: "Développeurs",
    title: "Une API vocale, facturée sans surprise",
    body: "Créez des agents par API, branchez vos outils par webhooks, choisissez votre LLM. Un prix à la minute qui inclut voix, transcription et téléphonie.",
    points: ["API REST et webhooks", "LLM au choix", "Événements d'appel en temps réel"],
    href: "/developers",
    cta: "Lire la documentation",
  },
];

const CODE_SAMPLES = [
  {
    label: "cURL",
    language: "bash",
    code: `curl https://callpme.com/api/v1/agents \\
  -H "Authorization: Bearer $CALLPME_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Accueil Cabinet Diallo",
    "role": "appointment",
    "voice": { "language": "fr-FR" }
  }'`,
  },
  {
    label: "JavaScript",
    language: "typescript",
    code: `const res = await fetch("https://callpme.com/api/v1/agents", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.CALLPME_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Accueil Cabinet Diallo",
    role: "appointment",
    voice: { language: "fr-FR" },
  }),
});
const { data: agent } = await res.json();`,
  },
  {
    label: "Python",
    language: "python",
    code: `import os, requests

agent = requests.post(
    "https://callpme.com/api/v1/agents",
    headers={"Authorization": f"Bearer {os.environ['CALLPME_KEY']}"},
    json={
        "name": "Accueil Cabinet Diallo",
        "role": "appointment",
        "voice": {"language": "fr-FR"},
    },
).json()["data"]`,
  },
];

const WEBHOOK_SAMPLE = [
  {
    label: "Webhook reçu",
    language: "json",
    code: `{
  "event": "call.completed",
  "data": {
    "id": "call_51a9e0",
    "agentId": "agt_8f2c1d",
    "agentName": "Accueil Cabinet Diallo",
    "durationSec": 112,
    "goalAchieved": true
  },
  "timestamp": "2026-11-05T09:42:11.000Z"
}`,
  },
];

const STEPS = [
  { n: "01", title: "Décrivez votre activité", body: "Collez l'adresse de votre site. Callpme en tire vos horaires, vos services et vos réponses fréquentes." },
  { n: "02", title: "Choisissez une voix", body: "Une voix française naturelle, avec l'accent de votre marché. Testez-la tout de suite dans le navigateur." },
  { n: "03", title: "Branchez vos outils", body: "Agenda Google ou Outlook, CRM, SMS. L'agent agit pendant l'appel au lieu de prendre un simple message." },
  { n: "04", title: "Mettez en ligne", body: "Prenez un numéro local ou renvoyez votre ligne actuelle. Chaque appel arrive transcrit et résumé." },
];

// Tarifs de lancement — hypothèses du cahier des charges, à valider avant publication.
const PLANS = [
  { name: "Starter", price: "29", fcfa: "19 000", minutes: "100 minutes incluses", extra: "0,25 € la minute en plus", features: ["1 agent", "1 numéro local", "Prise de rendez-vous"], highlight: false },
  { name: "Pro", price: "99", fcfa: "65 000", minutes: "500 minutes incluses", extra: "0,20 € la minute en plus", features: ["5 agents", "Campagnes sortantes", "Intégrations CRM"], highlight: true },
  { name: "Agence", price: "499", fcfa: "327 000", minutes: "3 000 minutes incluses", extra: "0,14 € la minute en plus", features: ["Marque blanche", "Clients illimités", "Refacturation à marge"], highlight: false },
];

const FAQ = [
  { q: "Mes clients sauront-ils qu'ils parlent à une IA ?", a: "Oui. L'agent l'annonce en début d'appel, comme l'exige l'AI Act européen. Dans la pratique, les appelants retiennent surtout qu'on leur a répondu tout de suite." },
  { q: "Puis-je garder mon numéro actuel ?", a: "Oui. Vous activez un renvoi d'appel vers Callpme, sur toutes vos lignes ou seulement en dehors des heures d'ouverture." },
  { q: "Comment se passe le paiement en Afrique ?", a: "Par Orange Money, MTN, Wave, Moov ou carte bancaire, en FCFA. Pas besoin de carte internationale." },
  { q: "Où sont stockées les données ?", a: "En Union européenne. Les enregistrements sont conservés selon la durée que vous choisissez, puis supprimés." },
  { q: "Que se passe-t-il si l'agent ne sait pas répondre ?", a: "Il transfère l'appel à la personne de votre choix ou prend un message détaillé, selon les règles que vous fixez." },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <>
      <div aria-hidden className="noise-overlay" />

      {/* HERO — split éditorial : titre à gauche, appel en direct à droite */}
      <section className="relative overflow-hidden pt-32 sm:pt-40">
        <div aria-hidden className="glow-brand pointer-events-none absolute -right-40 top-10 size-[720px] opacity-70" />
        <div aria-hidden className="bg-grid mask-fade-b pointer-events-none absolute inset-0 opacity-60" />

        <div className="container-marketing relative grid items-center gap-16 pb-24 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:pb-32">
          <div>
            <BlurFade>
              <span className="eyebrow">
                <span className="size-1.5 rounded-full bg-brand" />
                Agents vocaux IA · Europe et Afrique francophone
              </span>
            </BlurFade>
            <BlurFade delay={0.08}>
              <h1 className="mt-6 text-display-2xl font-semibold tracking-tight text-foreground text-balance">
                Votre entreprise décroche à chaque appel.
              </h1>
            </BlurFade>
            <BlurFade delay={0.16}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                Callpme répond au téléphone à votre place, en français naturel. Il prend les
                rendez-vous, qualifie les demandes et transfère les urgences. Vous retrouvez
                chaque appel transcrit et résumé.
              </p>
            </BlurFade>
            <BlurFade delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <PrimaryCta href="/register">Créer mon agent gratuitement</PrimaryCta>
                <Link
                  href="#produit"
                  className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Voir comment ça marche
                </Link>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Sans carte bancaire · Mobile Money accepté · Données hébergées en UE
              </p>
            </BlurFade>
          </div>

          <BlurFade delay={0.2} className="flex justify-center lg:justify-end">
            <HeroCallScene callerSrc="/hero/caller.png" />
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

      {/* SCÈNE — un appel de bout en bout */}
      <section id="demo" className="py-24 sm:py-32">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="En action"
            title="Un appel, de la sonnerie au résumé."
            subtitle="Voici ce qui se passe quand un client appelle votre garage à 2 h du matin."
          />
          <div className="mt-16">
            <CallJourney />
          </div>
        </div>
      </section>

      {/* PRODUIT — bento asymétrique */}
      <section id="produit" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Produit"
            title="Tout ce qu'un bon standard fait, sans pause."
            subtitle="Un seul outil pour répondre, agir et suivre. Pensé pour les marchés francophones, là où les plateformes américaines s'arrêtent."
          />

          <div className="mt-16 grid gap-4 md:grid-cols-6">
            <BentoCard className="md:col-span-4" icon={<Workflow className="size-5" strokeWidth={1.5} />} title="Un agent par métier" body="Six rôles prêts à l'emploi : standard, rendez-vous, support, qualification, vente, enquête. Chaque rôle arrive avec ses consignes et ses actions.">
              <div className="mt-8 flex flex-wrap gap-2">
                {ALL_ROLE_META.map((r) => (
                  <span key={r.key} className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 text-xs text-foreground">
                    <DynamicIcon name={r.icon} className="size-3.5 text-brand" strokeWidth={1.5} />
                    {r.label}
                  </span>
                ))}
              </div>
            </BentoCard>
            <BentoCard className="md:col-span-2" icon={<Smartphone className="size-5" strokeWidth={1.5} />} title="Mobile Money" body="Payez en FCFA avec Orange Money, MTN, Wave ou Moov. Aucune carte internationale demandée." />
            <BentoCard className="md:col-span-2" icon={<Globe2 className="size-5" strokeWidth={1.5} />} title="Numéros locaux" body="France, Belgique, Suisse, Canada. Les numéros ouest-africains arrivent ensuite." />
            <BentoCard className="md:col-span-2" icon={<CalendarCheck className="size-5" strokeWidth={1.5} />} title="Il agit pendant l'appel" body="Il réserve dans votre agenda, crée la fiche dans le CRM et envoie la confirmation par SMS." />
            <BentoCard className="md:col-span-2" icon={<BookOpen className="size-5" strokeWidth={1.5} />} title="Il connaît votre maison" body="Importez vos PDF, votre FAQ ou votre site. Il répond à partir de vos documents, pas d'Internet." />
            <BentoCard className="md:col-span-3" icon={<ChartNoAxesColumn className="size-5" strokeWidth={1.5} />} title="Chaque appel, lisible en dix secondes" body="Transcription, enregistrement, résumé et issue de l'appel. Les statistiques montrent ce que vos clients demandent vraiment." />
            <BentoCard className="md:col-span-3" icon={<Code2 className="size-5" strokeWidth={1.5} />} title="Ouvert aux développeurs" body="API REST, clés, webhooks signés. Tout ce que fait le tableau de bord se pilote aussi par code." />
          </div>
        </div>
      </section>

      {/* MÉTIERS */}
      <section id="metiers" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Métiers"
            title="Un agent qui parle comme votre métier."
            subtitle="Chaque modèle connaît le vocabulaire, les questions et les règles de son secteur. Choisissez le vôtre et écoutez."
          />
          <div className="mt-14">
            <TradesShowcase />
          </div>
        </div>
      </section>

      {/* TABLEAU DE BORD */}
      <section className="relative overflow-hidden border-t border-border py-24 sm:py-32">
        <div aria-hidden className="glow-brand pointer-events-none absolute -left-60 top-1/3 size-[640px] opacity-60" />
        <div className="container-marketing relative">
          <SectionHeading
            eyebrow="Tableau de bord"
            title="Tout ce que vos clients ont dit, sur un seul écran."
            subtitle="Appels, rendez-vous, taux de résolution. Vous voyez d'un coup d'œil ce qui marche et ce qu'il faut ajuster."
          />
          <BlurFade delay={0.1} className="mt-16">
            <DashboardPreview />
          </BlurFade>
          <p className="mt-4 text-center text-xs text-muted-foreground">Aperçu avec des données d'exemple.</p>
        </div>
      </section>

      {/* POUR QUI */}
      <section id="pour-qui" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Pour qui"
            title="Une plateforme, trois façons de l'utiliser."
            subtitle="Le même moteur vocal sert la PME qui veut un standard, l'agence qui revend et le développeur qui intègre."
          />
          <div className="mt-16 grid gap-4 lg:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <BlurFade key={a.key} delay={i * 0.08} className="h-full">
                <div className="bezel h-full">
                  <div className="bezel-core flex h-full flex-col p-7">
                    <span className="eyebrow w-fit">{a.tag}</span>
                    <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">{a.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                    <ul className="mt-6 space-y-2.5">
                      {a.points.map((p) => (
                        <li key={p} className="flex items-center gap-2.5 text-sm text-foreground">
                          <span className="size-1 rounded-full bg-brand" aria-hidden />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={a.href}
                      className="group mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-medium text-foreground"
                    >
                      {a.cta}
                      <ArrowUpRight className="size-4 transition-transform duration-300 ease-spring group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
                    </Link>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* DÉVELOPPEURS */}
      <section id="developpeurs" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32">
            <SectionHeading
              align="left"
              eyebrow="Développeurs"
              title="Trois lignes pour créer un agent."
              subtitle="Une API REST simple, des clés révocables et des webhooks pour chaque événement d'appel. Copiez, collez, appelez."
            />
            <ul className="mt-8 space-y-3 text-sm text-foreground">
              {["Authentification par clé Bearer", "Webhooks signés : call.completed, call.transferred, agent.updated", "Même modèle de données que le tableau de bord"].map((p) => (
                <li key={p} className="flex items-center gap-2.5">
                  <span className="size-1 rounded-full bg-brand" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <PrimaryCta href="/developers" variant="ghost">Documentation de l'API</PrimaryCta>
            </div>
          </div>
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
        </div>
      </section>

      {/* ÉTAPES */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Mise en route"
              title="Quinze minutes entre l'inscription et le premier appel."
              subtitle="Pas d'intégrateur, pas de frais de mise en place."
            />
          </div>
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
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing">
          <SectionHeading
            eyebrow="Tarifs"
            title="Un forfait clair, sans engagement."
            subtitle="Les minutes incluses couvrent la voix, la transcription et la téléphonie. Rien ne s'ajoute en bas de facture."
          />
          <div className="mt-16 grid gap-4 lg:grid-cols-3">
            {PLANS.map((p, i) => (
              <BlurFade key={p.name} delay={i * 0.08} className="h-full">
                <div className={cn("bezel h-full", p.highlight && "ring-brand/40")}>
                  <div className="bezel-core flex h-full flex-col p-7">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                      {p.highlight && <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand">Le plus choisi</span>}
                    </div>
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="text-5xl font-semibold tracking-tight text-foreground tabular">{p.price} €</span>
                      <span className="text-sm text-muted-foreground">HT / mois</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">soit {p.fcfa} FCFA</p>
                    <p className="mt-6 text-sm text-foreground">{p.minutes}</p>
                    <p className="text-sm text-muted-foreground">{p.extra}</p>
                    <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                          <span className="size-1 rounded-full bg-brand" aria-hidden />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-8">
                      <PrimaryCta href="/register" variant={p.highlight ? "brand" : "ghost"} full>
                        Commencer
                      </PrimaryCta>
                    </div>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Développeurs : 0,09 € la minute tout compris, à l'usage.{" "}
            <Link href="/developers" className="text-foreground underline underline-offset-4">Voir l'API</Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border py-24 sm:py-32">
        <div className="container-marketing grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading align="left" eyebrow="Questions" title="Ce qu'on nous demande le plus." subtitle="Une autre question ? Écrivez-nous depuis la page contact." />
          <div className="divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
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
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="pb-24 sm:pb-32">
        <div className="container-marketing">
          <div className="bezel">
            <div className="bezel-core relative overflow-hidden px-6 py-20 text-center sm:px-16">
              <div aria-hidden className="glow-brand pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2" />
              <h2 className="relative mx-auto max-w-2xl text-display-lg font-semibold tracking-tight text-foreground text-balance">
                Le prochain appel manqué peut être le dernier.
              </h2>
              <p className="relative mx-auto mt-5 max-w-lg text-muted-foreground">
                Créez votre agent maintenant et testez-le avant de payer quoi que ce soit.
              </p>
              <div className="relative mt-10 flex justify-center">
                <PrimaryCta href="/register">Créer mon agent gratuitement</PrimaryCta>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                     */
/* ------------------------------------------------------------------ */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  align?: "center" | "left";
}) {
  return (
    <BlurFade className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-5 text-display-lg font-semibold tracking-tight text-foreground text-balance">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{subtitle}</p>
    </BlurFade>
  );
}

function BentoCard({
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
function PrimaryCta({
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
