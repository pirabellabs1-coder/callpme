import type { Metadata } from "next";
import {
  BookOpen,
  CalendarCheck,
  Check,
  ChartNoAxesColumn,
  FileText,
  Globe,
  Mic,
  PhoneCall,
  ShieldCheck,
  Webhook,
  Workflow,
  MessageSquareText,
  UserRoundPlus,
} from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";
import {
  Bullet,
  CtaBand,
  PageHero,
  PrimaryCta,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Produit",
  description:
    "Studio d'agent, voix naturelles, base de connaissances, actions pendant l'appel, téléphonie, campagnes et analyses : le détail de chaque fonctionnalité Callpme.",
};

/* ------------------------------------------------------------------ */
/* Visuels propres à chaque module (maquettes HTML, données d'exemple) */
/* ------------------------------------------------------------------ */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className="bezel">
      <div className="bezel-core overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="ml-3 text-xs text-muted-foreground">{title}</span>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/50 px-4 py-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right font-medium", accent ? "text-brand" : "text-foreground")}>{value}</span>
    </div>
  );
}

function StudioVisual() {
  return (
    <Panel title="Nouvel agent · étape 3 sur 5">
      <div className="space-y-3">
        <Row label="Rôle" value="Prise de rendez-vous" />
        <Row label="Voix" value="Awa · français (Côte d'Ivoire)" />
        <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Consignes</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            Tu es l'assistante du cabinet Diallo. Propose les créneaux disponibles, confirme le nom
            et le numéro, puis envoie un SMS de confirmation.
          </p>
        </div>
        <div className="flex justify-end">
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">Tester l'agent</span>
        </div>
      </div>
    </Panel>
  );
}

function VoicesVisual() {
  const voices = [
    { name: "Awa", lang: "Français · Côte d'Ivoire", on: true, bars: [0.4, 0.8, 0.6, 1, 0.5, 0.7, 0.9, 0.45] },
    { name: "Louis", lang: "Français · France", on: false, bars: [0.6, 0.4, 0.9, 0.5, 0.8, 0.35, 0.7, 0.55] },
    { name: "Chloé", lang: "Français · Québec", on: false, bars: [0.5, 0.9, 0.4, 0.7, 0.6, 1, 0.45, 0.65] },
    { name: "Moussa", lang: "Français · Sénégal", on: false, bars: [0.7, 0.5, 0.8, 0.4, 0.9, 0.6, 0.5, 0.75] },
  ];
  return (
    <Panel title="Choix de la voix">
      <ul className="space-y-2.5">
        {voices.map((v) => (
          <li
            key={v.name}
            className={cn(
              "flex items-center gap-4 rounded-xl border px-4 py-3",
              v.on ? "border-brand/50 bg-brand/[0.08]" : "border-border bg-background/50",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{v.name}</span>
              <span className="block text-xs text-muted-foreground">{v.lang}</span>
            </span>
            <span className="flex h-6 items-center gap-[3px]">
              {v.bars.map((h, i) => (
                <span key={i} className={cn("w-[3px] rounded-full", v.on ? "bg-brand" : "bg-foreground/30")} style={{ height: `${h * 24}px` }} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function KnowledgeVisual() {
  const docs = [
    { name: "tarifs-2026.pdf", meta: "12 pages" },
    { name: "faq-patients.md", meta: "38 questions" },
    { name: "cabinet-diallo.com", meta: "24 pages web" },
  ];
  return (
    <Panel title="Base de connaissances">
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.name} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm">
            <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="flex-1 truncate text-foreground">{d.name}</span>
            <span className="text-xs text-muted-foreground">{d.meta}</span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">Indexé</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-border bg-background/50 p-4 text-sm">
        <p className="text-muted-foreground">« Combien coûte une consultation ? »</p>
        <p className="mt-2 text-foreground">« La consultation est à 25 000 FCFA, remboursable sur présentation de votre carte. »</p>
        <p className="mt-2 text-xs text-muted-foreground">Source : tarifs-2026.pdf, page 2</p>
      </div>
    </Panel>
  );
}

function ActionsVisual() {
  const items = [
    { icon: CalendarCheck, name: "Google Agenda", state: "Connecté" },
    { icon: UserRoundPlus, name: "HubSpot", state: "Connecté" },
    { icon: MessageSquareText, name: "SMS de confirmation", state: "Activé" },
    { icon: Webhook, name: "Webhook vers votre logiciel", state: "Activé" },
  ];
  return (
    <Panel title="Actions de l'agent">
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it.name} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-4 py-3 text-sm">
            <it.icon className="size-4 text-brand" strokeWidth={1.5} />
            <span className="flex-1 text-foreground">{it.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-success">
              <Check className="size-3.5" strokeWidth={2} /> {it.state}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TelephonyVisual() {
  return (
    <Panel title="Numéros et campagnes">
      <div className="space-y-2">
        <Row label="+33 1 •• •• •• 40" value="Standard · Paris" />
        <Row label="+32 2 •• •• •• 17" value="Support · Bruxelles" />
        <Row label="+1 514 •• •• 08" value="Ventes · Montréal" />
      </div>
      <div className="mt-4 rounded-xl border border-border bg-background/50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground">Campagne « Rappel rendez-vous »</span>
          <span className="text-muted-foreground tabular">312 / 480</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full w-[65%] rounded-full bg-brand" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Appels autorisés de 9 h à 19 h, du lundi au samedi</p>
      </div>
    </Panel>
  );
}

function AnalyticsVisual() {
  return (
    <Panel title="Appel du 5 novembre, 09:42">
      <div className="flex flex-wrap gap-2">
        {["Résolu", "Rendez-vous pris", "Ton positif"].map((t) => (
          <span key={t} className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">{t}</span>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Patiente existante. Demande de rendez-vous pour jeudi. Créneau de 16 h confirmé, SMS envoyé.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        {[
          ["Durée", "1 min 52"],
          ["Latence", "0,6 s"],
          ["Actions", "2"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-4 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success" strokeWidth={1.5} />
        Annonce IA activée · Conservation : 90 jours · Hébergement UE
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */

const MODULES = [
  {
    id: "studio",
    icon: Workflow,
    eyebrow: "Studio d'agent",
    title: "Un agent prêt en cinq étapes.",
    body: "Choisissez un rôle, une voix et vos consignes. Callpme rédige une première version des instructions, que vous ajustez librement.",
    points: ["Six rôles et des modèles par métier", "Consignes générées puis modifiables", "Test immédiat dans le navigateur, sans numéro"],
    Visual: StudioVisual,
  },
  {
    id: "voix",
    icon: Mic,
    eyebrow: "Voix et langues",
    title: "Une voix qui ressemble à vos clients.",
    body: "Des voix naturelles en français, avec l'accent de votre marché. L'agent gère les interruptions et parle à un rythme confortable.",
    points: ["Accents européens, africains et québécois", "Réglage du ton et du débit", "Interruption naturelle en cours de phrase"],
    Visual: VoicesVisual,
  },
  {
    id: "connaissances",
    icon: BookOpen,
    eyebrow: "Base de connaissances",
    title: "Il répond avec vos informations.",
    body: "Importez vos documents, votre FAQ ou votre site. L'agent répond uniquement à partir de ces contenus et sait dire quand il ne sait pas.",
    points: ["PDF, fichiers texte et pages web", "Réponses limitées à vos contenus", "Mise à jour à tout moment"],
    Visual: KnowledgeVisual,
  },
  {
    id: "actions",
    icon: CalendarCheck,
    eyebrow: "Actions",
    title: "Il agit pendant l'appel.",
    body: "L'agent réserve, enregistre et confirme pendant la conversation. Vous n'avez rien à ressaisir après coup.",
    points: ["Google Agenda, Outlook et Calendly", "Fiches dans votre CRM", "SMS, e-mail et webhooks vers vos outils"],
    Visual: ActionsVisual,
  },
  {
    id: "telephonie",
    icon: PhoneCall,
    eyebrow: "Téléphonie et campagnes",
    title: "Vos numéros, en entrant comme en sortant.",
    body: "Prenez un numéro local ou renvoyez votre ligne actuelle. Pour les relances et les rappels, lancez des campagnes d'appels sortants.",
    points: ["Numéros en France, Belgique, Suisse et Canada", "Transfert vers un humain à tout moment", "Campagnes planifiées dans les horaires autorisés"],
    Visual: TelephonyVisual,
  },
  {
    id: "analyses",
    icon: ChartNoAxesColumn,
    eyebrow: "Analyses et conformité",
    title: "Chaque appel, résumé et sécurisé.",
    body: "Enregistrement, transcription, résumé et issue de chaque appel. Les données restent dans l'UE et l'agent annonce qu'il est une IA.",
    points: ["Résumé et classement automatiques", "Durée de conservation configurable", "Conforme au RGPD et à l'AI Act"],
    Visual: AnalyticsVisual,
  },
];

export default function ProduitPage() {
  return (
    <>
      <PageHero
        eyebrow="Produit"
        title="Tout ce que fait un agent Callpme."
        subtitle="Six modules qui fonctionnent ensemble, de la configuration de l'agent jusqu'à l'analyse de chaque appel."
      >
        <PrimaryCta href="/register">Essayer gratuitement</PrimaryCta>
        <PrimaryCta href="/tarifs" variant="ghost">Voir les tarifs</PrimaryCta>
      </PageHero>

      {/* Sommaire des modules */}
      <nav aria-label="Modules" className="border-y border-border">
        <ul className="container-marketing flex gap-2 overflow-x-auto py-4 [scrollbar-width:none]">
          {MODULES.map((m) => (
            <li key={m.id} className="shrink-0">
              <a
                href={`#${m.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <m.icon className="size-4" strokeWidth={1.5} aria-hidden />
                {m.eyebrow}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {MODULES.map((m, i) => (
        <section key={m.id} id={m.id} className="scroll-mt-28 border-b border-border py-24 sm:py-28">
          <div className="container-marketing grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <BlurFade className={cn(i % 2 === 1 && "lg:order-2")}>
              <span className="eyebrow">
                <m.icon className="size-3.5" strokeWidth={1.5} aria-hidden />
                {m.eyebrow}
              </span>
              <h2 className="mt-5 text-display-md font-semibold tracking-tight text-foreground text-balance">{m.title}</h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">{m.body}</p>
              <ul className="mt-8 space-y-3">
                {m.points.map((p) => (
                  <Bullet key={p}>{p}</Bullet>
                ))}
              </ul>
            </BlurFade>
            <BlurFade delay={0.1}>
              <m.Visual />
            </BlurFade>
          </div>
        </section>
      ))}

      <section className="py-24 sm:py-32">
        <div className="container-marketing flex flex-col items-center text-center">
          <Globe className="size-6 text-brand" strokeWidth={1.5} aria-hidden />
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Vous cherchez un exemple dans votre secteur ? Consultez les{" "}
            <a href="/metiers" className="text-foreground underline underline-offset-4">exemples par métier</a>.
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
